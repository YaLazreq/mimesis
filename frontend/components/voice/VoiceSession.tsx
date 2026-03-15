"use client"

import React, { useRef, useState } from 'react';
import { MicOff, Mic } from 'lucide-react';
import { useVoiceAudio } from '@/hooks/useVoiceAudio';
import { useVoiceVisualizer } from '@/hooks/useVoiceVisualizer';

export interface VoiceSessionProps {
    /** Called when the user stops the session */
    onStop?: () => void;
    /** Emits Mimesis Agent Status (speaking, listening, etc) */
    onStatusChange?: (status: 'listening' | 'speaking' | 'thinking') => void;
}

/**
 * Full voice-reactive particle visualizer.
 * Auto-starts the microphone and audio analyser on mount.
 */
export default function VoiceSession({ onStop, onStatusChange }: VoiceSessionProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isMuted, setIsMuted] = useState(false);

    // ── Bi-Directional Audio Stream Setup ────────────────────────────
    const { 
        mediaStreamRef, 
        analyserRef, 
        dataArrayTimeRef, 
        dataArrayFreqRef 
    } = useVoiceAudio({ onStatusChange });

    // ── Canvas render loop ──────────────────────────────────────────
    useVoiceVisualizer({
        canvasRef,
        analyserRef,
        dataArrayTimeRef,
        dataArrayFreqRef
    });

    // ── Render ──────────────────────────────────────────────────────
    return (
        <div className="relative w-[300px] h-[70px] rounded-full overflow-hidden bg-transparent shadow-[0_0_30px_rgba(0,136,255,0.1)] border border-white flex items-center justify-center group">
            <canvas
                ref={canvasRef}
                className="absolute inset-0"
            />

            <button
                onClick={() => {
                    if (mediaStreamRef.current) {
                        const tracks = mediaStreamRef.current.getAudioTracks();
                        let mutedState = isMuted;
                        tracks.forEach((track: MediaStreamTrack) => {
                            track.enabled = !track.enabled;
                            mutedState = !track.enabled;
                        });
                        setIsMuted(mutedState);
                    }
                }}
                className={`z-10 absolute right-4 flex items-center justify-center w-8 h-8 rounded-full transition-all backdrop-blur-md cursor-pointer ${
                    isMuted 
                        ? 'bg-red-500/80 text-white hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                        : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white opacity-50 hover:opacity-100'
                }`}
                title={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
        </div>
    );
}
