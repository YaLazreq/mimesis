"use client"

import React, { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, X, Loader2, Sparkles } from 'lucide-react';
import { getVoiceSocket } from '@/hooks/voiceSocket';

interface ImageUploadProps {
    /** Session ID for the upload */
    sessionId: string;
    /** Optional context text from the user */
    userContext?: string;
    /** Called when upload completes successfully */
    onUploadComplete?: (gcsUri: string) => void;
    /** Called when image analysis begins (e.g. to show "thinking" status) */
    onAnalyzing?: () => void;
}

/**
 * Convert any image (WebP, HEIC, PNG, etc.) to JPEG via Canvas.
 * Also resizes to a max dimension to keep the payload reasonable.
 * Returns the base64-encoded JPEG string (no data URL prefix).
 */
function convertToJpeg(dataUrl: string, maxSize: number = 1024): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            // Resize if larger than maxSize
            if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas 2D context not available')); return; }
            ctx.drawImage(img, 0, 0, width, height);

            // Export as JPEG base64
            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(jpegDataUrl.split(',')[1]); // Return only the base64 part
        };
        img.onerror = () => reject(new Error('Failed to load image for conversion'));
        img.src = dataUrl;
    });
}

/**
 * Image upload component with drag & drop support.
 * - Sends image as JPEG to the Gemini Live model via WebSocket (direct vision).
 * - Uploads to backend for GCS storage + Worker 6 deep analysis.
 */
export default function ImageUpload({ sessionId, userContext = '', onUploadComplete, onAnalyzing }: ImageUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'done' | 'error'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            console.error('Not an image file');
            return;
        }

        // ── 1. Read file as data URL for preview + WebSocket ────────────
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;
            setPreview(dataUrl);

            // ── Send image to Gemini Live model via WebSocket ────────────
            // The Live API requires JPEG/PNG via send_realtime_input,
            // so we convert any format to JPEG first (max 1024px).
            const voiceWs = getVoiceSocket();
            if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
                try {
                    const jpegBase64 = await convertToJpeg(dataUrl);
                    voiceWs.send(JSON.stringify({
                        type: 'image',
                        data: jpegBase64,
                        mimeType: 'image/jpeg',
                    }));
                    console.log('📸 Image converted to JPEG and sent to Live model via WebSocket');
                    onAnalyzing?.();
                } catch (err) {
                    console.error('Failed to convert image to JPEG:', err);
                }
            } else {
                console.warn('⚠️ Voice WebSocket not connected — image not sent to Live model');
            }
        };
        reader.readAsDataURL(file);

        // ── 2. Upload to backend (GCS + Worker 6 structured analysis) ──
        setIsUploading(true);
        setUploadStatus('uploading');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('session_id', sessionId);
            if (userContext) {
                formData.append('user_context', userContext);
            }

            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
            const response = await fetch(`${backendUrl}/api/session/upload-image`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            setUploadStatus('analyzing');

            // After a short delay, mark as done (the worker notification will update the state)
            setTimeout(() => setUploadStatus('done'), 2000);

            onUploadComplete?.(result.gcs_uri);
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('error');
        } finally {
            setIsUploading(false);
        }
    }, [sessionId, userContext, onUploadComplete]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const resetUpload = useCallback(() => {
        setPreview(null);
        setUploadStatus('idle');
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    return (
        <div className="relative">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
            />

            {preview ? (
                /* Preview with status overlay */
                <div className="relative group">
                    <div className="relative w-[200px] h-[200px] rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
                        <img
                            src={preview}
                            alt="Uploaded product"
                            className="w-full h-full object-cover"
                        />

                        {/* Status overlay */}
                        <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${
                            uploadStatus === 'done' ? 'bg-black/20' : 'bg-black/50 backdrop-blur-sm'
                        }`}>
                            {uploadStatus === 'uploading' && (
                                <>
                                    <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                                    <span className="text-white/90 text-xs font-medium tracking-wider uppercase">Uploading…</span>
                                </>
                            )}
                            {uploadStatus === 'analyzing' && (
                                <>
                                    <Sparkles className="w-8 h-8 text-purple-300 animate-pulse mb-2" />
                                    <span className="text-purple-200 text-xs font-medium tracking-wider uppercase">Analyzing…</span>
                                </>
                            )}
                            {uploadStatus === 'done' && (
                                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500/80 flex items-center justify-center">
                                    <span className="text-white text-xs">✓</span>
                                </div>
                            )}
                            {uploadStatus === 'error' && (
                                <>
                                    <X className="w-8 h-8 text-red-400 mb-2" />
                                    <span className="text-red-300 text-xs font-medium tracking-wider uppercase">Error</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Reset button */}
                    {(uploadStatus === 'done' || uploadStatus === 'error') && (
                        <button
                            onClick={resetUpload}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-black transition-all cursor-pointer z-10"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            ) : (
                /* Drop zone */
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-[200px] h-[200px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 ${
                        isDragging
                            ? 'border-blue-400/60 bg-blue-500/10 scale-105 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
                            : 'border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]'
                    }`}
                >
                    <div className={`p-3 rounded-full transition-all duration-300 ${
                        isDragging ? 'bg-blue-500/20' : 'bg-white/5'
                    }`}>
                        {isDragging ? (
                            <ImageIcon className="w-6 h-6 text-blue-300" />
                        ) : (
                            <Upload className="w-6 h-6 text-white/40" />
                        )}
                    </div>
                    <div className="text-center">
                        <span className={`text-xs font-medium tracking-wider uppercase transition-colors ${
                            isDragging ? 'text-blue-300' : 'text-white/40'
                        }`}>
                            {isDragging ? 'Drop here' : 'Product Image'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
