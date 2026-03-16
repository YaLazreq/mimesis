"use client"

import React, { useRef, useEffect, useState, ReactNode } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/all';

gsap.registerPlugin(Flip);

interface ZeroGravitySpaceProps {
    children: ReactNode;
    onFocusChange?: (elementId: string | null, groupId: string | null) => void;
    /** Which step is currently active (1 = brand research, 2 = discovery brief).
     *  Groups with a non-matching data-step are "dormant" — hidden in orbit mode
     *  but visible as titles in the right-side list when another group is focused. */
    activeStep?: number;
}

/**
 * ── ZEROGRAVITYSPACE ────────────────────────────────────────────────────────
 * This orchestrator acts as the "Space" where elements float.
 * It handles:
 * - D. Focus IA: Moving a target to the center using GSAP FLIP while pushing
 *   others to the edges and blurring them (`filter: blur(15px)`).
 * - C. Repulsion (optional globally, but implemented here for child awareness): 
 *   On mousemove, pushes children away slightly.
 * - Phase-aware dormancy: Groups from the "wrong" step are hidden in orbit
 *   mode but animate to the right-side title list when any group is focused.
 */
export default function ZeroGravitySpace({ children, onFocusChange, activeStep }: ZeroGravitySpaceProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [focusedElementId, setFocusedElementId] = useState<string | null>(null);
    const focusedElementIdRef = useRef<string | null>(null);
    const focusedGroupIdRef = useRef<string | null>(null);
    const activeStepRef = useRef<number | undefined>(activeStep);

    // Keep activeStep ref in sync
    useEffect(() => {
        const prev = activeStepRef.current;
        activeStepRef.current = activeStep;

        // When active step changes and nothing is focused, re-apply dormancy
        if (prev !== activeStep && !focusedGroupIdRef.current && containerRef.current) {
            applyDormancy();
        }
    }, [activeStep]);

    /** Check if a group is dormant (wrong step) */
    const isGroupDormant = (group: HTMLElement): boolean => {
        const step = activeStepRef.current;
        if (!step) return false;
        const groupStep = group.getAttribute('data-step');
        if (!groupStep) return false; // No step attr → always active
        return parseInt(groupStep) !== step;
    };

    /** Apply dormancy: hide groups from the wrong step, show groups from the right step */
    const applyDormancy = () => {
        if (!containerRef.current) return;
        const allGroups = Array.from(containerRef.current.querySelectorAll('.floating-group')) as HTMLElement[];

        allGroups.forEach(g => {
            const dormant = isGroupDormant(g);
            gsap.to(g, {
                opacity: dormant ? 0 : 1,
                scale: dormant ? 0.8 : 1,
                duration: 0.8,
                ease: "power2.inOut",
                pointerEvents: dormant ? 'none' : 'auto',
            });
            const collapseInOrbit = g.hasAttribute('data-collapse-orbit');
            const hideItems = dormant || collapseInOrbit;
            const items = g.querySelector('.group-items');
            const connections = g.querySelector('.group-connections');
            if (items) gsap.to(items, { opacity: hideItems ? 0 : 1, duration: 0.6 });
            if (connections) gsap.to(connections, { opacity: hideItems ? 0 : 1, duration: 0.6 });
        });
    };

    // ── Phase C: Mouse Repulsion Physics ─────────────────────────────────────
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current || focusedGroupIdRef.current) return; // Disable during focus
            
            // Get all 'floating-orb' children (we'll tag the FloatingGroups/Items with this class)
            const orbs = containerRef.current.querySelectorAll('.floating-orb');
            
            orbs.forEach(orb => {
                // Skip orbs in dormant groups
                const parentGroup = orb.closest('.floating-group') as HTMLElement | null;
                if (parentGroup && isGroupDormant(parentGroup)) return;

                const rect = orb.getBoundingClientRect();
                // Find orb center
                const orbX = rect.left + rect.width / 2;
                const orbY = rect.top + rect.height / 2;
                
                // Calculate distance from cursor to orb center
                const dx = e.clientX - orbX;
                const dy = e.clientY - orbY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Repulsion force radius
                const repulseRadius = 250;
                
                if (dist < repulseRadius) {
                    // It is close to cursor. Push it away in the opposite direction.
                    // The closer it is, the stronger the push.
                    const force = (repulseRadius - dist) / repulseRadius;
                    
                    // Normalize vector
                    const nx = dx / dist;
                    const ny = dy / dist;
                    
                    const pushAmount = 30 * force; // Max push 30px
                    
                    gsap.to(orb, {
                        x: -nx * pushAmount,
                        y: -ny * pushAmount,
                        duration: 0.5,
                        ease: "power2.out",
                        overwrite: "auto" // Prevent conflicts with idle hover
                    });
                } else {
                    // Float back strictly to default relative to its idle state
                    gsap.to(orb, {
                        x: 0,
                        y: 0,
                        duration: 1.5,
                        ease: "sine.inOut",
                        overwrite: "auto"
                    });
                }
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // ── Phase D: Focus IA Method (Simulated via global listener) ───────────
    useEffect(() => {
        const handleFocusEvent = (e: Event) => {
            const customEvent = e as CustomEvent<{ elementId: string | null, groupId: string | null }>;
            let targetId = customEvent.detail.elementId;
            let targetGroupId = customEvent.detail.groupId;

            // Toggle logic: if we click the already focused item, unfocus.
            let isAlreadyFocusedGroup = false;
            if (targetGroupId && targetGroupId === focusedGroupIdRef.current) {
                isAlreadyFocusedGroup = true;
            }

            if ((targetId && targetId === focusedElementIdRef.current) || (!targetId && isAlreadyFocusedGroup)) {
                targetId = null;
                targetGroupId = null;
            }

            setFocusedElementId(targetId);
            focusedElementIdRef.current = targetId;
            focusedGroupIdRef.current = targetGroupId;
            
            if (onFocusChange) {
                onFocusChange(targetId, targetGroupId);
            }

            if (!containerRef.current) return;
            
            const allGroups = Array.from(containerRef.current.querySelectorAll('.floating-group')) as HTMLElement[];
            const centralEntity = containerRef.current.querySelector('.central-entity') as HTMLElement;
            const allOrbs = Array.from(containerRef.current.querySelectorAll('.floating-orb')) as HTMLElement[];

            if (targetId === null) {
                // ── RESTORE ALL (phase-aware) ──
                allGroups.forEach(g => {
                    const dormant = isGroupDormant(g);
                    gsap.to(g, {
                        x: 0,
                        y: 0,
                        scale: dormant ? 0.8 : 1,
                        opacity: dormant ? 0 : 1,
                        filter: "blur(0px)",
                        duration: 1.2,
                        ease: "power3.inOut",
                        pointerEvents: dormant ? 'none' : 'auto',
                    });

                    // Restore items & connections (only for active, non-collapsed groups)
                    const collapseInOrbit = g.hasAttribute('data-collapse-orbit');
                    const hideItems = dormant || collapseInOrbit;
                    const items = g.querySelector('.group-items');
                    const connections = g.querySelector('.group-connections');
                    if (items) gsap.to(items, { opacity: hideItems ? 0 : 1, duration: 0.8 });
                    if (connections) gsap.to(connections, { opacity: hideItems ? 0 : 1, duration: 0.8 });
                });

                if (centralEntity) {
                    gsap.to(centralEntity, {
                        y: 0,
                        scale: 1,
                        opacity: 1,
                        duration: 1.2,
                        ease: "power3.inOut"
                    });
                }

                allOrbs.forEach(orb => {
                    const parentGroup = orb.closest('.floating-group') as HTMLElement | null;
                    const dormant = parentGroup ? isGroupDormant(parentGroup) : false;
                    gsap.to(orb, { scale: 1, opacity: dormant ? 0 : 1, filter: "blur(0px)", duration: 1.2 });
                });
                
                return;
            }

            // ── A TARGET WAS FOCUSED ──
            const targetGroup = allGroups.find(g => g.getAttribute('data-group-id') === targetGroupId);
            const targetOrb = allOrbs.find(orb => orb.getAttribute('data-id') === targetId);

            const vW = window.innerWidth;
            const vH = window.innerHeight;

            // 1. Central Entity (Anchor to TOP)
            if (centralEntity) {
                gsap.to(centralEntity, {
                    y: -(vH * 0.35), // Move it gracefully to the top
                    scale: 0.65,
                    opacity: 1, // Keep it visible as requested
                    duration: 1.5,
                    ease: "power3.out"
                });
            }

            // 2. Other Groups (Anchor to RIGHT — ALL groups, including dormant, show as titles)
            const otherGroups = allGroups.filter(g => g !== targetGroup);
            otherGroups.forEach((g, index) => {
                const rect = g.getBoundingClientRect();
                // Get current GSAP translation to calculate true offset
                const currentX = gsap.getProperty(g, "x") as number || 0;
                const currentY = gsap.getProperty(g, "y") as number || 0;
                
                // Subtract current transform to get base layout position
                const baseCx = rect.left - currentX + rect.width / 2;
                const baseCy = rect.top - currentY + rect.height / 2;

                const targetXAbs = vW * 0.85; // Move to 85% of screen width (right side)
                const ySpacing = (vH * 0.6) / Math.max(1, otherGroups.length);
                const targetYAbs = (vH * 0.2) + (index * ySpacing); // Stack them vertically

                gsap.to(g, {
                    x: targetXAbs - baseCx,
                    y: targetYAbs - baseCy,
                    scale: 0.9,
                    opacity: 1, // Always visible as title — even dormant groups!
                    duration: 1.5,
                    ease: "power3.out",
                    clearProps: "filter",
                    pointerEvents: 'auto',
                });

                // Hide their nodes and lines (only show titles)
                const items = g.querySelector('.group-items');
                const connections = g.querySelector('.group-connections');
                if (items) gsap.to(items, { opacity: 0, duration: 0.8 });
                if (connections) gsap.to(connections, { opacity: 0, duration: 0.8 });
            });

            // 3. Selected Group (Center and Focus)
            if (targetGroup) {
                const rect = targetGroup.getBoundingClientRect();
                const currentX = gsap.getProperty(targetGroup, "x") as number || 0;
                const currentY = gsap.getProperty(targetGroup, "y") as number || 0;
                
                const baseCx = rect.left - currentX + rect.width / 2;
                const baseCy = rect.top - currentY + rect.height / 2;

                gsap.to(targetGroup, {
                    x: (vW / 2) - baseCx + 50, // Center it (shift slightly right of dead center to account for explorer/chat potentially)
                    y: (vH / 2) - baseCy + 50,
                    scale: 1,
                    opacity: 1,
                    filter: "blur(0px)",
                    duration: 1.5,
                    ease: "expo.out",
                    zIndex: 999,
                    pointerEvents: 'auto',
                });

                // Ensure its items and connections are visible
                const items = targetGroup.querySelector('.group-items');
                const connections = targetGroup.querySelector('.group-connections');
                if (items) gsap.to(items, { opacity: 1, duration: 0.8 });
                if (connections) gsap.to(connections, { opacity: 1, duration: 0.8 });
            }

            // 4. Target Orb: highlight it (only if a specific orb was clicked, not voice-triggered group focus)
            if (targetGroup) {
                const groupOrbs = Array.from(targetGroup.querySelectorAll('.floating-orb')) as HTMLElement[];
                if (targetOrb) {
                    // Mouse click: highlight specific orb, shrink others
                    groupOrbs.forEach(orb => {
                        if (orb === targetOrb) {
                            gsap.to(orb, { scale: 1.3, opacity: 1, duration: 1.2, clearProps: "filter" });
                        } else {
                            gsap.to(orb, { scale: 0.85, opacity: 1, duration: 1.2, clearProps: "filter" });
                        }
                    });
                } else {
                    // Voice focus: show all orbs equally
                    groupOrbs.forEach(orb => {
                        gsap.to(orb, { scale: 1, opacity: 1, duration: 1.2, clearProps: "filter" });
                    });
                }
            }
        };

        window.addEventListener('mimesis-focus', handleFocusEvent);
        return () => window.removeEventListener('mimesis-focus', handleFocusEvent);
    }, []);


    return (
        <div 
            ref={containerRef}
            className="w-full h-full absolute inset-0 overflow-hidden perspective-[1000px]"
            style={{ 
                // Will ensure we have an absolute positioning context for all children
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none', // Space shouldn't block clicks
            }}
        >
            {/* The children themselves will re-enable pointerEvents so they are clickable */}
            {children}
        </div>
    );
}
