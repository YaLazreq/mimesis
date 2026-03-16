"use client"

import React from 'react';

interface BriefSectionProps {
    title: string;
    icon: string;
    fields: { label: string; value: string | string[] | undefined }[];
    isVisible: boolean;
}

export default function BriefSection({ title, icon, fields, isVisible }: BriefSectionProps) {
    if (!isVisible) return null;
    
    const hasData = fields.some(f => f.value !== undefined && f.value !== '' && !(Array.isArray(f.value) && f.value.length === 0));
    if (!hasData) return null;

    return (
        <div
            className="bg-black/50 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 w-full max-w-[380px] text-left shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            style={{ animation: 'briefFadeIn 0.6s ease-out forwards' }}
        >
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{icon}</span>
                <h3
                    className="text-white/90 text-sm font-semibold uppercase tracking-widest"
                    style={{ fontFamily: 'var(--font-google-sans)' }}
                >
                    {title}
                </h3>
            </div>
            <div className="flex flex-col gap-3">
                {fields.map((field) => {
                    if (field.value === undefined || field.value === '' || (Array.isArray(field.value) && field.value.length === 0)) return null;
                    return (
                        <div
                            key={field.label}
                            className="flex flex-col gap-0.5"
                            style={{ animation: 'briefFieldIn 0.4s ease-out forwards' }}
                        >
                            <span className="text-white/30 text-[9px] uppercase tracking-wider font-mono">
                                {field.label}
                            </span>
                            {Array.isArray(field.value) ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {field.value.map((item, i) => (
                                        <span
                                            key={i}
                                            className="text-white/80 text-xs bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5"
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span
                                    className="text-white/80 text-sm leading-relaxed"
                                    style={{ fontFamily: 'var(--font-google-sans)' }}
                                >
                                    {field.value}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                @keyframes briefFadeIn {
                    from { opacity: 0; transform: translateY(12px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes briefFieldIn {
                    from { opacity: 0; transform: translateX(-8px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}
