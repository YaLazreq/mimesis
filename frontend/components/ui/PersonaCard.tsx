"use client"

import React from 'react';

interface PersonaCardProps {
    name?: string;
    summary?: string;
    ageRange?: string;
    gender?: string;
    mindset?: string;
    relationship?: string;
}

export default function PersonaCard({ name, summary, ageRange, gender, mindset, relationship }: PersonaCardProps) {
    if (!name && !summary) return null;

    return (
        <div
            className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-2xl border border-purple-400/15 rounded-2xl p-5 w-full max-w-[380px] text-left shadow-[0_8px_32px_rgba(139,92,246,0.1)]"
            style={{ animation: 'personaIn 0.7s ease-out forwards' }}
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-lg">
                    👤
                </div>
                <div>
                    <h3
                        className="text-white text-base font-semibold tracking-tight leading-none"
                        style={{ fontFamily: 'var(--font-google-sans)' }}
                    >
                        {name || 'Persona'}
                    </h3>
                    {ageRange && (
                        <span className="text-purple-300/60 text-[10px] font-mono">
                            {ageRange} · {gender || 'all'}
                        </span>
                    )}
                </div>
            </div>

            {summary && (
                <p
                    className="text-white/70 text-sm leading-relaxed mb-3"
                    style={{ fontFamily: 'var(--font-google-sans)' }}
                >
                    {summary}
                </p>
            )}

            {mindset && (
                <div className="flex flex-col gap-0.5 mb-2">
                    <span className="text-white/25 text-[8px] uppercase tracking-wider font-mono">Mindset</span>
                    <span className="text-white/60 text-xs italic leading-relaxed">{mindset}</span>
                </div>
            )}

            {relationship && (
                <div className="flex flex-col gap-0.5">
                    <span className="text-white/25 text-[8px] uppercase tracking-wider font-mono">Relationship</span>
                    <span className="text-purple-300/80 text-xs font-medium">{relationship}</span>
                </div>
            )}

            <style jsx>{`
                @keyframes personaIn {
                    from { opacity: 0; transform: translateY(12px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
