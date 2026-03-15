import { useEffect, useRef, MutableRefObject } from 'react';
import { Boid, CANVAS_WIDTH, CANVAS_HEIGHT, NUM_PARTICLES } from '@/components/voice/Boid';

interface UseVoiceVisualizerProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    analyserRef: MutableRefObject<AnalyserNode | null>;
    dataArrayTimeRef: MutableRefObject<Uint8Array<ArrayBuffer> | null>;
    dataArrayFreqRef: MutableRefObject<Uint8Array<ArrayBuffer> | null>;
}

export function useVoiceVisualizer({
    canvasRef,
    analyserRef,
    dataArrayTimeRef,
    dataArrayFreqRef
}: UseVoiceVisualizerProps) {
    const boidsRef = useRef<Boid[]>([]);
    const requestRef = useRef<number>(0);

    // Initialize particles
    useEffect(() => {
        const boids = [];
        for (let i = 0; i < NUM_PARTICLES; i++) {
            boids.push(new Boid());
        }
        boidsRef.current = boids;
    }, []);

    // Canvas render loop
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
    }, [analyserRef, canvasRef, dataArrayFreqRef, dataArrayTimeRef]);
}
