"use client"

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { typography } from "@/app/designSystem";

interface CentralEntityProps {
    name: string;
    slogan?: string;
}

export default function CentralEntity({ name, slogan }: CentralEntityProps) {
    const titleRef = useRef<HTMLDivElement>(null);
    const sloganRef = useRef<HTMLParagraphElement>(null);

    const lastAnimatedName = useRef<string | null>(null);
    const lastAnimatedSlogan = useRef<string | null>(null);

    useEffect(() => {
        if (!titleRef.current || !name) return;

        if (lastAnimatedName.current !== name) {
            lastAnimatedName.current = name;
            const tl = gsap.timeline();

            // Epic entrance for the brand name
            tl.fromTo(titleRef.current,
                { scale: 0.8, opacity: 0, filter: "blur(20px)" },
                { scale: 1, opacity: 1, filter: "blur(0px)", duration: 2, ease: "power3.out" }
            );

            // Extremely slow pulsing drift
            gsap.to(titleRef.current, {
                y: "+=15",
                rotation: 1,
                duration: 6,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
                delay: 2
            });
        }
    }, [name]);

    useEffect(() => {
        if (!sloganRef.current || !slogan) return;

        if (lastAnimatedSlogan.current !== slogan) {
            lastAnimatedSlogan.current = slogan;
            gsap.fromTo(sloganRef.current,
                { y: 20, opacity: 0 },
                { y: 0, opacity: 1, duration: 1.5, ease: "power2.out" }
            );
        }
    }, [slogan]);

    return (
        <div
            className="central-entity absolute left-1/2 top-1/2 flex flex-col items-center justify-center pointer-events-none z-20"
            style={{ transform: 'translate(-50%, -50%)' }}
        >
            <div ref={titleRef}>
                <h2
                    style={{
                        ...typography.welcomeTitle,
                        color: '#FFFFFF',
                        fontSize: '7rem', // Make it massive
                        textShadow: '0 4px 60px rgba(0,0,0,0.8)'
                    }}
                >
                    {name}
                </h2>
                {slogan && (
                    <p
                        ref={sloganRef}
                        className="text-center mt-8"
                        style={{
                            ...typography.bodyLarge,
                            fontFamily: 'var(--font-playfair)', // Use Playfair for slogan too for elegance
                            fontStyle: 'italic',
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '1.8rem',
                            textShadow: '0 2px 20px rgba(0,0,0,0.5)'
                        }}
                    >
                        {slogan}
                    </p>
                )}
            </div>
        </div>
    );
}

