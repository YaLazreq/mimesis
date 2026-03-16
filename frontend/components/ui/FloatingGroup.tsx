"use client"

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { typography } from "@/app/designSystem";

interface FloatingGroupProps {
    id: string;
    title: string;
    items: React.ReactNode[];
    // Center point of THIS group relative to the whole Space (in percentages 0-100)
    cx: number;
    cy: number;
    // Radius config for how far children orbit
    radius?: number;
}

export default function FloatingGroup({ id, title, items, cx, cy, radius = 200 }: FloatingGroupProps) {
    const groupRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLDivElement>(null);
    const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        if (!groupRef.current || !titleRef.current) return;

        const tl = gsap.timeline();

        tl.fromTo(titleRef.current,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 1.2, ease: "elastic.out(1, 0.75)" }
        );

        const validItems = itemsRef.current.filter(Boolean);
        if (validItems.length > 0) {
            tl.fromTo(validItems,
                { scale: 0, opacity: 0 },
                { scale: 1, opacity: 1, duration: 1, ease: "back.out(1.5)", stagger: 0.1 },
                "-=0.8"
            );
        }

    }, [items.length, radius]);

    const svgSize = Math.max(800, radius * 3.5);
    const center = svgSize / 2;

    return (
        <div
            ref={groupRef}
            id={id}
            data-group-id={id}
            className="floating-group absolute"
            style={{
                left: `${cx}%`,
                top: `${cy}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 10
            }}
        >
            <svg
                className="group-connections absolute pointer-events-none transition-opacity duration-500"
                style={{
                    width: `${svgSize}px`,
                    height: `${svgSize}px`,
                    left: `-${center}px`,
                    top: `-${center}px`,
                    overflow: 'visible'
                }}
            >
                {items.map((_, i) => {
                    const angle = i * ((Math.PI * 2) / items.length);
                    // Start line significantly away from center title to reduce clutter
                    const innerRadius = radius * 0.45;
                    const x1 = center + Math.cos(angle) * innerRadius;
                    const y1 = center + Math.sin(angle) * (innerRadius * 0.7);

                    // Stop line slightly before the items
                    const x2 = center + Math.cos(angle) * (radius * 0.75);
                    const y2 = center + Math.sin(angle) * (radius * 0.7 * 0.75);

                    if (items.length <= 1 && radius === 0) return null;

                    return (
                        <line
                            key={`line-${i}`}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="1"
                            strokeDasharray="2 6"
                        />
                    );
                })}
            </svg>

            <div
                ref={titleRef}
                className="group-title absolute text-center whitespace-nowrap pointer-events-none z-10"
                style={{
                    transform: 'translate(-50%, -50%)',
                }}
            >
                <h3 style={{ fontFamily: 'var(--font-google-sans)', color: '#fff', fontSize: '1.75rem', fontWeight: 500, letterSpacing: '-0.5px' }}>
                    {title}
                </h3>
            </div>

            <div className="group-items absolute inset-0 transition-opacity duration-500">
                {items.map((item, i) => {
                    const angle = i * ((Math.PI * 2) / items.length);
                    const xPos = Math.cos(angle) * radius;
                    const yPos = Math.sin(angle) * (radius * 0.7);

                    return (
                        <div
                            key={`wrapper-${i}`}
                            ref={el => { itemsRef.current[i] = el; }}
                            style={{
                                position: 'absolute',
                                left: `${xPos}px`,
                                top: `${yPos}px`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: 1
                            }}
                        >
                            {item}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

