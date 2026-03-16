"use client"

import React from 'react';
import { AgentState } from '@/types/AgentState';

interface BrandSidebarProps {
    state: AgentState;
}

/** Condensed Step 1 brand data for display in the right sidebar during Step 2. */
export default function BrandSidebar({ state }: BrandSidebarProps) {
    const sections: { key: string; label: string; render: () => React.ReactNode }[] = [
        {
            key: 'identity',
            label: 'Brand Identity',
            render: () => (
                <div className="flex flex-col gap-2">
                    {state.brand_name && (
                        <div className="flex items-center gap-2">
                            <span className="text-white font-semibold text-base" style={{ fontFamily: 'var(--font-google-sans)' }}>
                                {state.brand_name}
                            </span>
                        </div>
                    )}
                    {state.brand_slogan && (
                        <span className="text-white/50 text-xs italic">{state.brand_slogan}</span>
                    )}
                    {state.primary_color && state.primary_color.length > 0 && (
                        <div className="flex gap-1.5 mt-1">
                            {state.primary_color.map((c, i) => (
                                <div key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} title={c} />
                            ))}
                            {state.secondary_color?.map((c, i) => (
                                <div key={`s-${i}`} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} title={c} />
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'mission',
            label: 'Mission',
            render: () => state.brand_mission ? (
                <div className="flex flex-wrap gap-1">
                    {state.brand_mission.map((m, i) => (
                        <span key={i} className="text-white/70 text-[11px] bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                            {m}
                        </span>
                    ))}
                </div>
            ) : null,
        },
        {
            key: 'strategy',
            label: 'Strategy',
            render: () => state.brand_strategy ? (
                <div className="flex flex-col gap-1.5">
                    {state.brand_strategy.map((s, i) => (
                        <span key={i} className="text-white/60 text-xs leading-relaxed">
                            • {typeof s === 'object' ? s.title : s}
                        </span>
                    ))}
                </div>
            ) : null,
        },
        {
            key: 'symbols',
            label: 'Symbols',
            render: () => state.brand_symbols ? (
                <div className="flex flex-wrap gap-1.5">
                    {state.brand_symbols.map((s, i) => (
                        <span key={i} className="text-white/70 text-[11px] bg-white/5 border border-white/10 rounded-md px-2 py-0.5">
                            {typeof s === 'object' ? s.title : s}
                        </span>
                    ))}
                </div>
            ) : null,
        },
        {
            key: 'keywords',
            label: 'Style Keywords',
            render: () => state.style_keywords ? (
                <div className="flex flex-wrap gap-1">
                    {state.style_keywords.map((kw, i) => (
                        <span key={i} className="text-white/60 text-[10px] italic">{kw}</span>
                    ))}
                </div>
            ) : null,
        },
        {
            key: 'news',
            label: 'Latest News',
            render: () => state.brand_last_news ? (
                <div className="flex flex-col gap-1">
                    {state.brand_last_news.slice(0, 3).map((n, i) => (
                        <span key={i} className="text-white/50 text-[11px] leading-snug truncate">
                            • {typeof n === 'object' ? n.title : n}
                        </span>
                    ))}
                </div>
            ) : null,
        },
        {
            key: 'campaigns',
            label: 'Campaigns',
            render: () => state.brand_viral_campaign ? (
                <div className="flex flex-col gap-0.5">
                    {state.brand_viral_campaign.map((c, i) => (
                        <span key={i} className="text-white/50 text-[11px] italic">{c}</span>
                    ))}
                </div>
            ) : null,
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-white/50 uppercase tracking-widest text-xs font-semibold">
                Brand DNA
            </h2>
            {sections.map(({ key, label, render }) => {
                const content = render();
                if (!content) return null;
                return (
                    <div
                        key={key}
                        className="flex flex-col gap-1.5 bg-white/[0.03] rounded-lg p-3 border border-white/5"
                    >
                        <span className="text-white/30 text-[9px] uppercase tracking-wider font-mono">
                            {label}
                        </span>
                        {content}
                    </div>
                );
            })}
        </div>
    );
}
