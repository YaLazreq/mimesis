"use client"

import React, { useCallback, useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';
import { colors, typography } from '@/app/designSystem';
import { Boid, CANVAS_WIDTH, CANVAS_HEIGHT, NUM_PARTICLES } from './Boid';
import { useWakeWord } from './useWakeWord';

interface VoiceParticlesProps {
  /** Called when the wake word is detected or the button is clicked */
  onActivated?: () => void;
}

export default function VoiceWakeUp({ onActivated }: VoiceParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boidsRef = useRef<Boid[]>([]);
  const requestRef = useRef<number>(0);

  // ── Particle initialization ─────────────────────────────────────
  useEffect(() => {
    const boids = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      boids.push(new Boid());
    }
    boidsRef.current = boids;
  }, []);

  // ── Activation handler ──────────────────────────────────────────
  const handleActivated = useCallback(() => {
    onActivated?.();
  }, [onActivated]);

  // ── Wake word detection ─────────────────────────────────────────
  const { isActive: isWakeWordActive } = useWakeWord({
    onDetected: handleActivated,
    enabled: true,
  });

  // ── Idle canvas render loop (no audio, subtle animation) ────────
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

    const render = (time: number) => {
      // Fade for trail effect
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.globalCompositeOperation = 'source-over';

      const boids = boidsRef.current;
      for (const boid of boids) {
        boid.update(boids, 0, 0, time);
        boid.draw(ctx, 0, 0);
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

      <button
        onClick={handleActivated}
        className="z-10 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all backdrop-blur-md border border-white/10 cursor-pointer"
        style={{
          color: colors.text.primary,
        }}
      >
        <Mic
          size={16}
          className={isWakeWordActive ? 'animate-pulse' : ''}
          style={{ color: isWakeWordActive ? '#0088ff' : undefined }}
        />
        Say
        <span style={typography.buttonMediumItalic}>
          &quot;Hey Mimesis&quot;
        </span>
      </button>
    </div>
  );
}
