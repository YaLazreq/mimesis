"use client"

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface FloatingItemProps {
    id: string;
    children: React.ReactNode;
    delay?: number;
}

export default function FloatingItem({ id, children, delay = 0 }: FloatingItemProps) {
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!itemRef.current) return;
        const el = itemRef.current;

        // Phase B: Idle (Levitation)
        // We create an infinite yoyo timeline that randomly translates the item slightly
        const randomX = gsap.utils.random(-15, 15);
        const randomY = gsap.utils.random(-15, 15);
        const randomRot = gsap.utils.random(-3, 3);
        const duration = gsap.utils.random(3, 6);

        const tl = gsap.timeline({
            repeat: -1,
            yoyo: true,
            delay: delay
        });

        tl.to(el, {
            x: `+=${randomX}`,
            y: `+=${randomY}`,
            rotation: randomRot,
            duration: duration,
            ease: "sine.inOut"
        });

        return () => {
            tl.kill();
        };
    }, [delay]);

    const handleMouseEnter = () => {
        if (!itemRef.current) return;
        
        // Phase C: Hover Magnetic Scale
        gsap.to(itemRef.current, {
            scale: 1.15,
            duration: 0.4,
            ease: "back.out(1.5)",
            zIndex: 50, // Pop to front
            overwrite: "auto" // Pause the idle translation gently
        });
    };

    const handleMouseLeave = () => {
        if (!itemRef.current) return;
        
        // Restore scale
        gsap.to(itemRef.current, {
            scale: 1,
            duration: 0.4,
            ease: "power2.out",
            zIndex: 1, // Will be overridden by the group's flow but resets our inline boost
            overwrite: "auto"
        });
    };

    const handleClick = () => {
        if (!itemRef.current) return;
        
        const groupEl = itemRef.current.closest('.floating-group');
        const groupId = groupEl ? groupEl.getAttribute('data-group-id') : null;
        
        // Trigger Focus IA event targeting both the individual item and its parent group
        const event = new CustomEvent('mimesis-focus', { detail: { elementId: id, groupId } });
        window.dispatchEvent(event);
    };

    return (
        <div 
            ref={itemRef} 
            className="floating-orb floating-item relative cursor-pointer"
            data-id={id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ 
                willChange: 'transform, filter', 
                pointerEvents: 'auto',
                // Center the transform origin
                transformOrigin: 'center center'
            }}
        >
            {children}
        </div>
    );
}
