"use client"

import React, { useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';
import { Boid, CANVAS_WIDTH, CANVAS_HEIGHT, NUM_PARTICLES } from './Boid';

interface VoiceSessionProps {
    /** Called when the user stops the session */
    onStop?: () => void;
}

/**
 * Full voice-reactive particle visualizer.
 * Auto-starts the microphone and audio analyser on mount.
 */
export default function VoiceSession({ onStop }: VoiceSessionProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayTimeRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const dataArrayFreqRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const boidsRef = useRef<Boid[]>([]);
    const requestRef = useRef<number>(0);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    const socketRef = useRef<WebSocket | null>(null);
    const playerNodeRef = useRef<AudioWorkletNode | null>(null);

    // ── Particle initialization ─────────────────────────────────────
    useEffect(() => {
        const boids = [];
        for (let i = 0; i < NUM_PARTICLES; i++) {
            boids.push(new Boid());
        }
        boidsRef.current = boids;
    }, []);

    // ── Bi-Directional Audio Stream Setup ────────────────────────────
    useEffect(() => {
        let isMounted = true;
        let recorderAudioContext: AudioContext | null = null;
        let playerAudioContext: AudioContext | null = null;
        let localStream: MediaStream | null = null;
        let recorderNode: AudioWorkletNode | null = null;

        // Generate random IDs for the session
        const userId = "demo_user_" + Math.random().toString(36).substring(7);
        const sessionId = "demo_session_" + Math.random().toString(36).substring(7);

        // Handle websocket URL according to backend path: /ws/{user_id}/{session_id}
        const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
        let cleanBaseUrl = baseUrl.endsWith('/ws') ? baseUrl.slice(0, -3) : baseUrl;
        cleanBaseUrl = cleanBaseUrl.endsWith('/') ? cleanBaseUrl.slice(0, -1) : cleanBaseUrl;
        const wsUrl = `${cleanBaseUrl}/ws/${userId}/${sessionId}`;

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected ✅", wsUrl);
        };

        ws.onerror = (err) => {
            console.error("WebSocket error ❌", err);
        };

        ws.onclose = (ev) => {
            console.log("WebSocket closed", ev.code, ev.reason);
        };

        // ── BUG FIX #1: Set onmessage IMMEDIATELY — not inside async setupAudio().
        // This prevents missing events that arrive while getUserMedia/addModule are still loading.
        // playerNodeRef.current might be null at first, so we buffer audio until it's ready.
        const pendingAudioBuffers: ArrayBuffer[] = [];
        let eventCount = 0;
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                eventCount++;

                // Log first 5 events fully
                if (eventCount <= 5) {
                    console.log(`[ADK Event #${eventCount} FULL]`, JSON.stringify(data).substring(0, 800));
                }

                // Handle transcriptions (just log them)
                if (data.inputTranscription) {
                    console.log("[🎤 You said]", data.inputTranscription.text);
                }
                if (data.outputTranscription) {
                    console.log("[🤖 Gemini said]", data.outputTranscription.text);
                }

                // Extract parts from content (check both ADK and raw Gemini formats)
                const parts = data.content?.parts
                    || data.serverContent?.modelTurn?.parts
                    || [];

                // Log structure of content events so we can debug
                if (parts.length > 0) {
                    const partKeys = parts.map((p: any) => Object.keys(p));
                    console.log(`[Content] ${parts.length} part(s), keys:`, partKeys);
                }

                parts.forEach((part: any) => {
                    // Check BOTH camelCase (inlineData) and snake_case (inline_data)
                    const inlineData = part.inlineData || part.inline_data;

                    if (inlineData?.data) {
                        // Gemini returns URL-safe base64 (uses - and _ instead of + and /)
                        // window.atob() only handles standard base64, so we must convert first
                        const base64Data = inlineData.data
                            .replace(/-/g, '+')
                            .replace(/_/g, '/');
                        const mimeType = inlineData.mimeType || inlineData.mime_type || 'unknown';

                        // Decode standard base64 to binary ArrayBuffer
                        const binaryString = window.atob(base64Data);
                        const len = binaryString.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }

                        console.log(`[Audio] 🔊 Got ${len} bytes (${mimeType}), playerReady=${!!playerNodeRef.current}`);

                        if (playerNodeRef.current) {
                            playerNodeRef.current.port.postMessage(bytes.buffer);
                        } else {
                            pendingAudioBuffers.push(bytes.buffer);
                            console.log("[Audio] Buffered chunk, player not ready yet");
                        }
                    }

                    // Handle text parts
                    if (part.text) {
                        console.log("[Gemini Text]", part.text);
                    }
                });

                // Log turn completion
                if (data.turnComplete) {
                    console.log("[Turn Complete] ✅");
                }
            } catch {
                // Non-JSON or unexpected format — ignore
            }
        };

        const setupAudio = async () => {
            try {
                // Get microphone access
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (!isMounted) {
                    localStream.getTracks().forEach(t => t.stop());
                    return;
                }

                // ── BUG FIX #3: Use 16kHz for recording to match backend mime_type "audio/pcm;rate=16000"
                // The backend hardcodes rate=16000 when sending to Gemini, so we MUST record at 16kHz.
                recorderAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                    sampleRate: 16000,
                });
                // Store for visualizer
                audioContextRef.current = recorderAudioContext;

                // Use 24kHz for playback because Gemini outputs audio at 24kHz
                playerAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                    sampleRate: 24000,
                });

                // Resume both AudioContexts (browsers suspend them until user gesture)
                await Promise.all([
                    recorderAudioContext.state === 'suspended' ? recorderAudioContext.resume() : Promise.resolve(),
                    playerAudioContext.state === 'suspended' ? playerAudioContext.resume() : Promise.resolve(),
                ]);
                console.log("AudioContexts resumed ▶️ (recorder: 16kHz, player: 24kHz)");

                // Load the worklets
                await Promise.all([
                    recorderAudioContext.audioWorklet.addModule('/pcm/pcm-recorder-processor.js'),
                    playerAudioContext.audioWorklet.addModule('/pcm/pcm-player-processor.js'),
                ]);
                if (!isMounted) return;

                // ── RECORDER pipeline (Mic -> Recorder Worklet -> WebSocket)
                recorderNode = new AudioWorkletNode(recorderAudioContext, 'pcm-recorder-processor');
                const micSource = recorderAudioContext.createMediaStreamSource(localStream);
                micSource.connect(recorderNode);

                recorderNode.port.onmessage = (event) => {
                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                        socketRef.current.send(event.data);
                    }
                };

                // ── PLAYER pipeline (WebSocket -> Player Worklet -> Speakers)
                const playerNode = new AudioWorkletNode(playerAudioContext, 'pcm-player-processor');
                playerNode.connect(playerAudioContext.destination);
                playerNodeRef.current = playerNode;
                console.log("Player worklet connected to speakers 🔊");

                // Flush any audio buffers that arrived before the player was ready
                if (pendingAudioBuffers.length > 0) {
                    console.log(`[Audio] Flushing ${pendingAudioBuffers.length} buffered chunks`);
                    for (const buf of pendingAudioBuffers) {
                        playerNode.port.postMessage(buf);
                    }
                    pendingAudioBuffers.length = 0;
                }

                // ── Analyser for Visualizer (Particles)
                mediaStreamRef.current = localStream;
                const analyser = recorderAudioContext.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.8;
                micSource.connect(analyser);
                analyserRef.current = analyser;
                dataArrayTimeRef.current = new Uint8Array(analyser.frequencyBinCount);
                dataArrayFreqRef.current = new Uint8Array(analyser.frequencyBinCount);

            } catch (err) {
                console.error("Audio setup error:", err);
            }
        };

        setupAudio();

        return () => {
            isMounted = false;
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            if (recorderNode) {
                recorderNode.disconnect();
            }
            if (playerNodeRef.current) {
                playerNodeRef.current.disconnect();
                playerNodeRef.current = null;
            }
            if (localStream) {
                localStream.getTracks().forEach(t => t.stop());
            }
            if (recorderAudioContext) {
                recorderAudioContext.close();
            }
            if (playerAudioContext) {
                playerAudioContext.close();
            }
        };
    }, []);

    // ── Canvas render loop ──────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = CANVAS_WIDTH * dpr;
        canvas.height = CANVAS_HEIGHT * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${CANVAS_WIDTH}px`;
        canvas.style.height = `${CANVAS_HEIGHT}px`;

        let smoothedVolume = 0;
        let smoothedPitch = 0;

        const render = (time: number) => {
            let currentVolume = 0;
            let currentPitch = 0;

            if (analyserRef.current && dataArrayTimeRef.current && dataArrayFreqRef.current) {
                analyserRef.current.getByteTimeDomainData(dataArrayTimeRef.current);
                analyserRef.current.getByteFrequencyData(dataArrayFreqRef.current);

                let rms = 0;
                for (let i = 0; i < dataArrayTimeRef.current.length; i++) {
                    const val = (dataArrayTimeRef.current[i] - 128) / 128;
                    rms += val * val;
                }
                currentVolume = Math.min(1, Math.sqrt(rms / dataArrayTimeRef.current.length) * 3.5);

                let freqSum = 0;
                let weightSum = 0;
                for (let i = 0; i < dataArrayFreqRef.current.length; i++) {
                    freqSum += dataArrayFreqRef.current[i] * i;
                    weightSum += dataArrayFreqRef.current[i];
                }
                const centroid = weightSum === 0 ? 0 : freqSum / weightSum;

                currentPitch = Math.min(1, centroid / 40);
            }

            smoothedVolume = smoothedVolume * 0.8 + currentVolume * 0.2;
            smoothedPitch = smoothedPitch * 0.9 + currentPitch * 0.1;

            // Fade existing particles for a trail effect
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.globalCompositeOperation = 'source-over';

            if (smoothedVolume > 0.05) {
                const glowIntensity = Math.min(1, smoothedVolume * 2);
                const gradient = ctx.createRadialGradient(
                    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
                    CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH / 2
                );
                gradient.addColorStop(0, `rgba(0, 136, 255, ${glowIntensity * 0.15})`);
                gradient.addColorStop(1, 'rgba(0, 136, 255, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }

            const boids = boidsRef.current;
            for (const boid of boids) {
                boid.update(boids, smoothedVolume, smoothedPitch, time);
                boid.draw(ctx, smoothedVolume, smoothedPitch);
            }

            requestRef.current = requestAnimationFrame(render);
        };

        requestRef.current = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // ── Render ──────────────────────────────────────────────────────
    return (
        <div className="relative w-[300px] h-[70px] rounded-full overflow-hidden bg-transparent shadow-[0_0_30px_rgba(0,136,255,0.1)] border border-white flex items-center justify-center group">
            <canvas
                ref={canvasRef}
                className="absolute inset-0"
            />

            {onStop && (
                <button
                    onClick={onStop}
                    className="z-10 absolute right-4 opacity-0 group-hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all backdrop-blur-md cursor-pointer"
                    title="Stop Session"
                >
                    <MicOff size={14} />
                </button>
            )}
        </div>
    );
}
