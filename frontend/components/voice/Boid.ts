/**
 * Boid particle — a flocking agent that reacts to audio volume and pitch.
 * Used to create an organic, sound-reactive particle swarm.
 */

export const CANVAS_WIDTH = 367;
export const CANVAS_HEIGHT = 80;
export const NUM_PARTICLES = 600;

export class Boid {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    baseColorOffset: number;
    shape: 'circle' | 'streak' | 'diamond';

    constructor() {
        this.x = Math.random() * CANVAS_WIDTH;
        this.y = Math.random() * CANVAS_HEIGHT;
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

        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;
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
        if (this.x > CANVAS_WIDTH - margin) this.vx -= 0.05 + movementVolume * 0.2;
        if (this.y < margin) this.vy += 0.1 + movementVolume * 0.4;
        if (this.y > CANVAS_HEIGHT - margin) this.vy -= 0.1 + movementVolume * 0.4;
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
