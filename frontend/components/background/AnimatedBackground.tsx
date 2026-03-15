"use client"

import React, { useMemo } from 'react';
import { useMimesisTheme } from '@/contexts/MimesisThemeContext';

/**
 * AnimatedBackground — Apple Music technique applied to abstract morphing shapes.
 *
 * How it works (same technique as Apple Music):
 *
 * 1. BASE FILL          Dominant color fills the viewport (safety net, no gaps)
 * 2. ABSTRACT ARTWORK   5-6 organic blob shapes with gradient fills, each
 *                        morphing its own form smoothly via CSS border-radius
 *                        animation. Gradients shift within each shape.
 *                        This layer is the "album art" equivalent.
 * 3. SCALE + BLUR       The artwork layer is rendered at 350% of the viewport
 *                        and blurred at 100px. This merges the shapes into a
 *                        seamless, paint-like color field — exactly like how
 *                        Apple Music blurs the cover art.
 * 4. SLOW DRIFT         The oversized artwork slowly drifts and rotates on
 *                        a ~30s loop, so dark and bright regions trade places.
 * 5. DARK OVERLAY       Semi-transparent overlay for text readability.
 * 6. NOISE + VIGNETTE   Subtle grain and radial darkening for cinematic depth.
 *
 * Starts as pure black. Smoothly transitions when brand colors arrive.
 */

// ─── Blob Shape Definitions ────────────────────────────────────────────────
// Each blob is an organic shape that morphs between border-radius keyframes.
// The shapes are large, overlapping, and positioned across the "canvas".

interface BlobDef {
    /** Position within the artwork layer (percentage) */
    x: string;
    y: string;
    /** Size as percentage of the artwork layer */
    size: string;
    /** Morph animation duration (seconds) — each is different for organic feel */
    morphDuration: number;
    /** Gradient angle shift duration (seconds) */
    gradientDuration: number;
    /** Opacity of this blob */
    opacity: number;
}

const BLOBS: BlobDef[] = [
    // Container is 350% viewport. Visible screen is ~35% to 65% of the container.
    // We group all shapes tightly in that center window so they all mix together on-screen!
    { x: '40%', y: '35%', size: '25%', morphDuration: 18, gradientDuration: 12, opacity: 0.85 },
    { x: '55%', y: '45%', size: '30%', morphDuration: 22, gradientDuration: 15, opacity: 0.75 },
    { x: '35%', y: '55%', size: '35%', morphDuration: 25, gradientDuration: 18, opacity: 0.7 },
    { x: '60%', y: '35%', size: '25%', morphDuration: 20, gradientDuration: 14, opacity: 0.8 },
    { x: '45%', y: '60%', size: '30%', morphDuration: 28, gradientDuration: 20, opacity: 0.6 },
    { x: '50%', y: '40%', size: '35%', morphDuration: 24, gradientDuration: 16, opacity: 0.65 },
];

// Border-radius keyframe sets for morphing — each blob gets a unique set
// Format: "topLeft topRight bottomRight bottomLeft / topLeft topRight bottomRight bottomLeft"
const MORPH_KEYFRAMES: string[][] = [
    // Blob 0
    ['40% 60% 70% 30% / 40% 50% 60% 50%', '70% 30% 50% 50% / 30% 60% 70% 40%', '50% 60% 30% 60% / 60% 40% 50% 30%', '30% 50% 60% 70% / 50% 30% 40% 60%'],
    // Blob 1
    ['60% 40% 30% 70% / 50% 60% 40% 50%', '30% 60% 70% 40% / 60% 40% 30% 70%', '70% 30% 50% 50% / 40% 50% 60% 40%', '40% 70% 60% 30% / 30% 60% 50% 50%'],
    // Blob 2
    ['50% 50% 40% 60% / 60% 40% 50% 50%', '60% 40% 60% 40% / 40% 60% 40% 60%', '40% 60% 50% 50% / 50% 50% 60% 40%', '55% 45% 45% 55% / 45% 55% 55% 45%'],
    // Blob 3
    ['35% 65% 55% 45% / 55% 45% 35% 65%', '65% 35% 45% 55% / 45% 55% 65% 35%', '45% 55% 65% 35% / 35% 65% 45% 55%', '55% 45% 35% 65% / 65% 35% 55% 45%'],
    // Blob 4
    ['70% 30% 60% 40% / 30% 70% 40% 60%', '40% 60% 30% 70% / 60% 40% 70% 30%', '55% 45% 50% 50% / 50% 50% 55% 45%', '30% 70% 45% 55% / 70% 30% 55% 45%'],
    // Blob 5
    ['45% 55% 65% 35% / 55% 45% 35% 65%', '55% 45% 35% 65% / 45% 55% 65% 35%', '65% 35% 55% 45% / 35% 65% 45% 55%', '35% 65% 45% 55% / 65% 35% 55% 45%'],
];

// ─── Excited Blob Definitions ──────────────────────────────────────────────
// These blobs are smaller, more energetic, and travel widely across the canvas
// to break up the color logic and add dynamic steaks of contrast.

interface ExcitedBlobDef {
    size: string;
    morphDuration: number;
    pathDuration: number;
    gradientDuration: number;
    opacity: number;
}

const EXCITED_BLOBS: ExcitedBlobDef[] = [
    { size: '20%', morphDuration: 10, pathDuration: 25, gradientDuration: 8, opacity: 0.95 },
    { size: '25%', morphDuration: 14, pathDuration: 35, gradientDuration: 10, opacity: 0.85 },
];

// ─── Build gradient colors from theme ──────────────────────────────────────

// ─── Build pronounced gradient from primary color only ───────────────────────

function getPronouncedGradient(index: number, primary: string[] | undefined): [string, string, string] {
    const pArr = primary || ['#000000'];
    const pLen = pArr.length;

    // Cycle through whatever primary colors the agent provides so ALL of them
    // are represented on the screen at the same time!
    const baseColor = pArr[index % pLen];
    const nextColor = pArr[(index + 1) % pLen];

    // If the brand only has 1 primary color, synthesize contrasting tints/shades to create volume.
    // If they have multiple, mix them together!
    const stop1 = baseColor;
    const stop2 = pLen > 1 ? nextColor : `color-mix(in srgb, ${baseColor}, white 15%)`;
    const stop3 = pLen > 2 ? pArr[(index + 2) % pLen] : `color-mix(in srgb, ${baseColor}, black 20%)`;

    // Rotate the order of the stops based on the blob index to create variety
    switch (index % 6) {
        case 0: return [stop1, stop2, stop3];
        case 1: return [stop3, stop1, stop2];
        case 2: return [stop2, stop3, stop1];
        case 3: return [stop1, stop3, stop2];
        case 4: return [stop3, stop2, stop1];
        case 5: return [stop2, stop1, stop3];
        default: return [stop1, stop2, stop3];
    }
}

// ─── Build high-contrast gradient for excited blobs ────────────────────────

function getExcitedGradient(index: number, primary: string[] | undefined): [string, string, string] {
    const pArr = primary || ['#000000'];
    // Pick a primary color, but offset it so it contrasts with its neighbors
    const baseColor = pArr[(index + 2) % pArr.length];

    // Synthesize a highly contrasting "excited" color using only the primary color
    // by mixing it heavily with pure white. We no longer use secondary color at all!
    const excitedHigh = `color-mix(in srgb, ${baseColor}, white 50%)`;
    const excitedLow = `color-mix(in srgb, ${baseColor}, white 20%)`;
    return [excitedHigh, baseColor, excitedLow];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AnimatedBackground() {
    const { theme } = useMimesisTheme();

    const hasColors = !!theme && ((theme.primaryColor && theme.primaryColor.length > 0));
    // Base fill is strictly the primary color, or black if none
    const baseFill = theme?.primaryColor?.[0] || '#000000';

    // ── Generate keyframe CSS ──────────────────────────────────────────
    const keyframesCSS = useMemo(() => {
        let css = '';

        // Morph keyframes for each blob
        BLOBS.forEach((_, i) => {
            const frames = MORPH_KEYFRAMES[i];
            css += `
                @keyframes morph-${i} {
                    0%, 100% { border-radius: ${frames[0]}; }
                    33% { border-radius: ${frames[1]}; }
                    66% { border-radius: ${frames[2]}; }
                    85% { border-radius: ${frames[3]}; }
                }
            `;
        });

        // Gradient shift keyframes (shared — moves background-position)
        css += `
            @keyframes gradient-shift {
                0%, 100% { background-position: 0% 50%; }
                25% { background-position: 100% 0%; }
                50% { background-position: 100% 100%; }
                75% { background-position: 0% 100%; }
            }
        `;

        // Artwork drift — the whole oversized layer slowly drifts
        css += `
            @keyframes artwork-drift {
                0%, 100% { transform: translate(0%, 0%) rotate(0deg) scale(1); }
                20% { transform: translate(3%, -2%) rotate(1.5deg) scale(1.02); }
                40% { transform: translate(-2%, 4%) rotate(-1deg) scale(0.98); }
                60% { transform: translate(4%, -1%) rotate(2deg) scale(1.01); }
                80% { transform: translate(-3%, 2%) rotate(-1.5deg) scale(0.99); }
            }
        `;

        // Wide, sweeping travel paths for the excited blobs, contained loosely within viewport
        css += `
            @keyframes excited-path-0 {
                0%, 100% { transform: translate(0, 0) scale(1); }
                25% { transform: translate(40vw, 30vh) scale(1.4); }
                50% { transform: translate(-30vw, 20vh) scale(0.8); }
                75% { transform: translate(-20vw, -40vh) scale(1.2); }
            }
            @keyframes excited-path-1 {
                0%, 100% { transform: translate(-20vw, 30vh) scale(1.2); }
                30% { transform: translate(-40vw, -20vh) scale(0.9); }
                60% { transform: translate(30vw, -30vh) scale(1.5); }
                85% { transform: translate(40vw, 10vh) scale(1.1); }
            }
        `;

        return css;
    }, []);

    return (
        <>
            <style jsx global>{keyframesCSS}</style>

            <div
                className="fixed inset-0 overflow-hidden"
                style={{ zIndex: 0 }}
            >
                {/* ─── Layer 1: Base color fill ─────────────────────────────── */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundColor: baseFill,
                        transition: 'background-color 2s ease-in-out',
                    }}
                />

                {/* ─── Layer 2: Abstract artwork (scaled + blurred) ────────── */}
                <div
                    className="absolute"
                    style={{
                        /* Oversized: 350% of viewport, centered */
                        width: '350%',
                        height: '350%',
                        left: '-125%',
                        top: '-125%',
                        /* Heavy blur — this is the Apple Music secret sauce */
                        filter: 'blur(100px) saturate(1.5)',
                        /* Slow drift animation */
                        animation: 'artwork-drift 50s ease-in-out infinite',
                        willChange: 'transform, filter',
                    }}
                >
                    {BLOBS.map((blob, i) => {
                        const [c1, c2, c3] = getPronouncedGradient(i, theme?.primaryColor);

                        return (
                            <div
                                key={i}
                                style={{
                                    position: 'absolute',
                                    left: blob.x,
                                    top: blob.y,
                                    width: blob.size,
                                    height: blob.size,
                                    /* Gradient fill that shifts within the shape */
                                    backgroundImage: hasColors
                                        ? `linear-gradient(135deg, ${c1}, ${c2}, ${c3}, ${c1})`
                                        : 'none',
                                    backgroundSize: '200% 200%',
                                    /* Morphing shape + shifting gradient */
                                    animation: `morph-${i} ${blob.morphDuration}s ease-in-out infinite, gradient-shift ${blob.gradientDuration}s ease-in-out infinite`,
                                    opacity: hasColors ? blob.opacity : 0,
                                    /* Smooth color transitions when theme changes */
                                    transition: 'background-image 2s ease-in-out, opacity 2s ease-in-out',
                                    willChange: 'border-radius, background-position',
                                }}
                            />
                        );
                    })}

                    {/* Excited Blobs (The contrasting disrupters) */}
                    {EXCITED_BLOBS.map((blob, i) => {
                        const [c1, c2, c3] = getExcitedGradient(i, theme?.primaryColor);
                        // Reuse morph keyframes from the main set to avoid duplication
                        const morphIndex = i % MORPH_KEYFRAMES.length;

                        return (
                            <div
                                key={`excited-${i}`}
                                style={{
                                    position: 'absolute',
                                    // Start them around the center, they will travel via transforms
                                    left: '50%',
                                    top: '50%',
                                    width: blob.size,
                                    height: blob.size,
                                    backgroundImage: hasColors
                                        ? `linear-gradient(135deg, ${c1}, ${c2}, ${c3}, ${c1})`
                                        : 'none',
                                    backgroundSize: '200% 200%',
                                    animation: `excited-path-${i} ${blob.pathDuration}s ease-in-out infinite, morph-${morphIndex} ${blob.morphDuration}s ease-in-out infinite, gradient-shift ${blob.gradientDuration}s ease-in-out infinite`,
                                    opacity: hasColors ? blob.opacity : 0,
                                    transition: 'background-image 2s ease-in-out, opacity 2s ease-in-out',
                                    willChange: 'transform, border-radius, background-position',
                                }}
                            />
                        );
                    })}
                </div>

                {/* ─── Layer 3: Dark overlay for readability ────────────────── */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.20)',
                    }}
                />

                {/* ─── Layer 4: Noise grain for depth ──────────────────────── */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        opacity: 0.03,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'repeat',
                        mixBlendMode: 'overlay',
                    }}
                />

                {/* ─── Layer 5: Vignette ───────────────────────────────────── */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)',
                    }}
                />
            </div>
        </>
    );
}
