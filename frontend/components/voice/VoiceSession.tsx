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

    // ── Particle initialization ─────────────────────────────────────
    useEffect(() => {
        const boids = [];
        for (let i = 0; i < NUM_PARTICLES; i++) {
            boids.push(new Boid());
        }
        boidsRef.current = boids;
    }, []);

    // ── Auto-start audio analyser on mount ──────────────────────────
    useEffect(() => {
        let cancelled = false;

        // ── Websocket connection
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
        socketRef.current = new WebSocket(wsUrl);
        socketRef.current.onopen = () => {
            console.log("Connexion WebSocket établie ! ✅");
        };

        // ── Audio recording
        const startAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                // ── MediaRecorder listen to the data stream
                // 1. Ensure the AudioContext is initialized (use your existing audioCtx)
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
                    sampleRate: 24000, // Important: matching Gemini's preference
                });
                // 2. Load the processor from your /public folder
                await audioCtx.audioWorklet.addModule('/pcm/pcm-recorder-processor.js');
                // 3. Create the Worklet Node
                const recorderNode = new AudioWorkletNode(audioCtx, 'pcm-recorder-processor');

                // 4. Connect the source to the processor
                const source2 = audioCtx.createMediaStreamSource(stream);
                source2.connect(recorderNode);

                recorderNode.port.onmessage = (event) => {
                    // event.data contains the Int16Array of PCM samples
                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                        socketRef.current.send(event.data);
                    }
                };

                mediaStreamRef.current = stream;

                // Analysis for animation
                const analyser = audioCtx.createAnalyser();

                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.8;

                const source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);

                audioContextRef.current = audioCtx;
                analyserRef.current = analyser;
                dataArrayTimeRef.current = new Uint8Array(analyser.frequencyBinCount);
                dataArrayFreqRef.current = new Uint8Array(analyser.frequencyBinCount);
            } catch (err) {
                console.error("Error accessing microphone:", err);
            }
        };

        startAudio();

        return () => {
            cancelled = true;
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
                mediaStreamRef.current = null;
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
