import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Download } from 'lucide-react';

const WIDTH = 367;
const HEIGHT = 80;
const NUM_PARTICLES = 300;

class Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseColorOffset: number;
  shape: 'circle' | 'streak' | 'diamond';

  constructor() {
    this.x = Math.random() * WIDTH;
    this.y = Math.random() * HEIGHT;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 0.15 + 0.05;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.size = Math.random() * 1.2 + 0.4;
    this.baseColorOffset = Math.random() * 0.2;
    
    const shapeRand = Math.random();
    if (shapeRand < 0.5) this.shape = 'circle';
    else if (shapeRand < 0.8) this.shape = 'streak';
    else this.shape = 'diamond';
  }

  update(boids: Boid[], volume: number, pitch: number, time: number) {
    let sepX = 0, sepY = 0;
    let aliX = 0, aliY = 0;
    let cohX = 0, cohY = 0;
    let total = 0;

    // Deep voices (low pitch) will have a smaller multiplier, resulting in less movement
    const pitchMultiplier = 0.2 + pitch * 3.0;
    const movementVolume = volume * pitchMultiplier;

    const perceptionRadius = 15 + movementVolume * 40; 
    const separationRadius = 8 + movementVolume * 20;

    for (const other of boids) {
      if (other === this) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < perceptionRadius * perceptionRadius) {
        const dist = Math.sqrt(distSq);
        
        if (dist < separationRadius && dist > 0) {
          sepX += dx / dist;
          sepY += dy / dist;
        }

        aliX += other.vx;
        aliY += other.vy;

        cohX += other.x;
        cohY += other.y;

        total++;
      }
    }

    if (total > 0) {
      aliX /= total;
      aliY /= total;
      cohX /= total;
      cohY /= total;

      cohX = cohX - this.x;
      cohY = cohY - this.y;
    }

    const noiseX = Math.sin(this.y * 0.03 + time * 0.0002) + Math.cos(this.x * 0.02 + time * 0.0001);
    const noiseY = Math.cos(this.x * 0.03 + time * 0.0002) + Math.sin(this.y * 0.02 + time * 0.0001);

    this.vx += sepX * (0.01 + movementVolume * 0.1) + aliX * (0.005 + movementVolume * 0.02) + cohX * (0.002 + movementVolume * 0.01) + noiseX * (0.01 + movementVolume * 0.08);
    this.vy += sepY * (0.01 + movementVolume * 0.1) + aliY * (0.005 + movementVolume * 0.02) + cohY * (0.002 + movementVolume * 0.01) + noiseY * (0.01 + movementVolume * 0.08);

    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const centerPull = Math.max(0.00005, 0.0005 - movementVolume * 0.001);
    this.vx += (centerX - this.x) * centerPull;
    this.vy += (centerY - this.y) * centerPull * 2;

    this.vx *= 0.96;
    this.vy *= 0.96;

    const maxSpeed = 0.15 + movementVolume * 15;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;

    const margin = 5;
    if (this.x < margin) this.vx += 0.05 + movementVolume * 0.2;
    if (this.x > WIDTH - margin) this.vx -= 0.05 + movementVolume * 0.2;
    if (this.y < margin) this.vy += 0.1 + movementVolume * 0.4;
    if (this.y > HEIGHT - margin) this.vy -= 0.1 + movementVolume * 0.4;
  }

  draw(ctx: CanvasRenderingContext2D, volume: number, pitch: number) {
    const intensity = Math.min(1, pitch * 0.5 + volume * 2 + this.baseColorOffset);
    
    const r = Math.floor(0 + intensity * 255);
    const g = Math.floor(136 + intensity * 119);
    const b = 255;
    
    const a = Math.min(1, 0.3 + volume * 3 + intensity * 0.4);

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    ctx.lineWidth = this.size * 0.8;
    
    const currentSize = this.size * (1 + volume * 3);

    ctx.beginPath();
    if (this.shape === 'circle') {
      ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'streak') {
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy) + 0.1;
      const dirX = (this.vx / speed) * currentSize * 2;
      const dirY = (this.vy / speed) * currentSize * 2;
      ctx.moveTo(this.x - dirX, this.y - dirY);
      ctx.lineTo(this.x + dirX, this.y + dirY);
      ctx.stroke();
    } else if (this.shape === 'diamond') {
      ctx.moveTo(this.x, this.y - currentSize * 1.5);
      ctx.lineTo(this.x + currentSize, this.y);
      ctx.lineTo(this.x, this.y + currentSize * 1.5);
      ctx.lineTo(this.x - currentSize, this.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isListening, setIsListening] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayTimeRef = useRef<Uint8Array | null>(null);
  const dataArrayFreqRef = useRef<Uint8Array | null>(null);
  const boidsRef = useRef<Boid[]>([]);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const boids = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      boids.push(new Boid());
    }
    boidsRef.current = boids;
  }, []);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayTimeRef.current = new Uint8Array(analyser.frequencyBinCount);
      dataArrayFreqRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      setIsListening(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure you have granted permission.");
    }
  };

  const stopListening = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create a temporary canvas to apply the exact pill shape and background for Figma
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;

    // We don't want a solid background for Figma export anymore, just transparent
    // Draw the actual particle canvas over it
    tCtx.drawImage(canvas, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'voice-particles-figma.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;

    let smoothedVolume = 0;
    let smoothedPitch = 0;

    const render = (time: number) => {
      let currentVolume = 0;
      let currentPitch = 0;

      if (isListening && analyserRef.current && dataArrayTimeRef.current && dataArrayFreqRef.current) {
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

      // Fade existing particles for a trail effect on a transparent background
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalCompositeOperation = 'source-over';

      if (smoothedVolume > 0.05) {
        const glowIntensity = Math.min(1, smoothedVolume * 2);
        const gradient = ctx.createRadialGradient(WIDTH/2, HEIGHT/2, 0, WIDTH/2, HEIGHT/2, WIDTH/2);
        gradient.addColorStop(0, `rgba(0, 136, 255, ${glowIntensity * 0.15})`);
        gradient.addColorStop(1, 'rgba(0, 136, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
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
  }, [isListening]);

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-light text-white mb-2 tracking-wide">Voice Particles</h1>
        <p className="text-neutral-400 text-sm">Speak to animate the nano particles</p>
      </div>

      <div className="relative w-[367px] h-[80px] rounded-full overflow-hidden bg-transparent shadow-[0_0_30px_rgba(0,136,255,0.1)] border border-white flex items-center justify-center group">
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0" 
        />
        
        {!isListening ? (
          <button 
            onClick={startListening}
            className="z-10 flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all backdrop-blur-md border border-white/10 cursor-pointer"
          >
            <Mic size={16} />
            Enable Microphone
          </button>
        ) : (
          <button 
            onClick={stopListening}
            className="z-10 absolute right-4 opacity-0 group-hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all backdrop-blur-md cursor-pointer"
            title="Stop Microphone"
          >
            <MicOff size={14} />
          </button>
        )}
      </div>

      <button 
        onClick={downloadImage}
        className="mt-8 flex items-center gap-2 text-neutral-400 hover:text-white text-xs font-medium px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5 cursor-pointer"
        title="Download snapshot for Figma"
      >
        <Download size={14} />
        Export PNG for Figma
      </button>
    </div>
  );
}
