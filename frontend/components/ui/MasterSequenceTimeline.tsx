"use client"

import React from 'react';
import { MasterSequenceScene } from '@/types/AgentState';

// Beat emotions → accent colors
const BEAT_COLORS: Record<number, string> = {
    1: '#ef4444', // Hook — red/tension
    2: '#3b82f6', // Context — blue/calm
    3: '#f59e0b', // Product — amber/focus
    4: '#8b5cf6', // Transformation — purple/shift
    5: '#ec4899', // Climax — pink/peak
    6: '#10b981', // Resolution — green/resolve
};

interface MasterSequenceTimelineProps {
    scenes: MasterSequenceScene[];
    validated?: boolean;
}

export default function MasterSequenceTimeline({ scenes, validated }: MasterSequenceTimelineProps) {
    if (!scenes || scenes.length === 0) return null;

    return (
        <div
            className="mx-auto"
            style={{ width: '850px', minWidth: '850px', animation: 'timelineFadeIn 0.8s ease-out forwards' }}
        >
            {/* Title */}
            <div className="flex items-center gap-3 mb-8">
                <h2
                    className="text-white text-2xl font-semibold tracking-tight"
                    style={{ fontFamily: 'var(--font-google-sans)', letterSpacing: '-0.5px' }}
                >
                    Master Sequence
                </h2>
                {validated && (
                    <span className="text-xs font-medium uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                        ✓ Validated
                    </span>
                )}
            </div>

            {/* Timeline track */}
            <div className="relative">
                {/* Connecting line */}
                <div className="absolute top-8 left-8 right-8 h-[2px] bg-gradient-to-r from-white/10 via-white/20 to-white/10 z-0" />

                {/* Scene cards */}
                <div className="grid grid-cols-6 gap-4 relative z-10">
                    {scenes.map((scene, i) => {
                        const accentColor = BEAT_COLORS[scene.scene_number] || '#ffffff';

                        return (
                            <div
                                key={scene.scene_number}
                                className="flex flex-col items-center gap-3 group"
                                style={{
                                    animation: `scenePop 0.5s ease-out ${i * 0.12}s both`,
                                }}
                            >
                                {/* Beat dot */}
                                <div
                                    className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold border-2 transition-all duration-300 group-hover:scale-110"
                                    style={{
                                        borderColor: accentColor,
                                        color: accentColor,
                                        backgroundColor: `${accentColor}15`,
                                        boxShadow: `0 0 25px ${accentColor}25`,
                                    }}
                                >
                                    {scene.scene_number}
                                </div>

                                {/* Card */}
                                <div
                                    className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-4 w-full text-left transition-all duration-300 group-hover:border-white/20 group-hover:bg-black/70 min-h-[180px]"
                                    style={{
                                        boxShadow: `0 4px 20px ${accentColor}12`,
                                    }}
                                >
                                    <span
                                        className="text-xs font-bold uppercase tracking-wider block mb-1.5"
                                        style={{ color: accentColor }}
                                    >
                                        {scene.beat_name}
                                    </span>
                                    <span className="text-white/50 text-[11px] italic block mb-3">
                                        {scene.emotion}
                                    </span>
                                    <p
                                        className="text-white/80 text-[12px] leading-relaxed"
                                        style={{ fontFamily: 'var(--font-google-sans)' }}
                                    >
                                        {scene.action_summary}
                                    </p>
                                    <span className="text-white/30 text-[10px] font-mono block mt-3">
                                        {scene.duration_estimate}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style jsx>{`
                @keyframes timelineFadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes scenePop {
                    from { opacity: 0; transform: translateY(16px) scale(0.9); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
