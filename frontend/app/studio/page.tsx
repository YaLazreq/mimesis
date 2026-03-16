"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { typography } from "../designSystem";
import VoiceSession from "@/components/voice/VoiceSession";
import AnimatedBackground from "@/components/background/AnimatedBackground";
import InfoBadge from "@/components/ui/InfoBadge";
import ZeroGravitySpace from "@/components/ui/ZeroGravitySpace";
import CentralEntity from "@/components/ui/CentralEntity";
import FloatingGroup from "@/components/ui/FloatingGroup";
import FloatingItem from "@/components/ui/FloatingItem";
import { useAgentState } from "@/contexts/AgentStateContext";
import { ExternalLink, X, Database, Braces } from 'lucide-react';

export default function StudioPage() {
    const router = useRouter();
    const { state, isComponentVisible } = useAgentState();
    const [isExplorerOpen, setIsExplorerOpen] = useState(false);
    const [isJsonOpen, setIsJsonOpen] = useState(false);
    const [agentStatus, setAgentStatus] = useState<'listening' | 'speaking' | 'thinking'>('listening');
    const [focusedElementId, setFocusedElementId] = useState<string | null>(null);

    // Derived state for focus
    const focusedNewsIndex = focusedElementId?.startsWith('news-') ? parseInt(focusedElementId.split('-')[1]) : null;
    const focusedNewsItem = focusedNewsIndex !== null ? state.brand_last_news?.[focusedNewsIndex] : null;
    const hasSummaryToDisplay = focusedNewsItem && focusedNewsItem.summary;

    // ── Voice → Focus IA Bridge ──────────────────────────────────────────────
    // Maps component IDs (from agent's set_ui_layout) to FloatingGroup IDs
    const COMPONENT_TO_GROUP: Record<string, string> = {
        style_keywords: 'group-keywords',
        brand_symbols: 'group-symbols',
        brand_strategy: 'group-strategy',
        brand_mission: 'group-mission',
        brand_common_enemy: 'group-enemy',
        brand_last_news: 'group-news',
        brand_viral_campaign: 'group-campaigns',
    };

    const prevVisibleRef = useRef<string[] | undefined>(undefined);
    useEffect(() => {
        const vc = state.visible_components;
        const prev = prevVisibleRef.current;
        prevVisibleRef.current = vc;

        // Skip the very first render (no previous value yet)
        if (prev === undefined) return;

        // If no layout set, or "all" → restore default view
        if (!vc || vc.length === 0 || vc.includes('all')) {
            window.dispatchEvent(
                new CustomEvent('mimesis-focus', { detail: { elementId: null, groupId: null } })
            );
            return;
        }

        // Only trigger focus if the agent explicitly isolated ONE component.
        // Background workers append multiple components progressively, which should NOT trigger focus.
        if (vc.length === 1) {
            const focusComponent = vc[0];
            if (COMPONENT_TO_GROUP[focusComponent]) {
                const groupId = COMPONENT_TO_GROUP[focusComponent];
                // Dispatch a focus event targeting the group (no specific item)
                window.dispatchEvent(
                    new CustomEvent('mimesis-focus', { detail: { elementId: `${groupId}-voice`, groupId } })
                );
                return;
            }
        }

        // If multiple components are visible (e.g. progressively loaded by workers),
        // ensure no specific group is focused, maintaining the default layout.
        window.dispatchEvent(
            new CustomEvent('mimesis-focus', { detail: { elementId: null, groupId: null } })
        );
    }, [state.visible_components]);

    return (
        <>
            {/* Apple Music-style animated background — always renders as base layer */}
            <AnimatedBackground />

            {/* Content layer — sits above the background */}
            <div
                className="relative flex flex-col min-h-screen"
                style={{ zIndex: 1 }}
            >
                {/* Header */}
                <header className="absolute top-0 left-0 w-full flex items-center justify-between p-6 z-50 pointer-events-none">
                    <div className="flex items-center gap-2 pointer-events-auto">
                        <h1
                            onClick={() => window.location.href = '/'}
                            style={{
                                ...typography.h2,
                                fontSize: '24px',
                                letterSpacing: '-0.8px',
                                lineHeight: '1',
                                cursor: 'pointer',
                            }}
                        >
                            Mimesis
                        </h1>
                        <InfoBadge text="Creative Storyteller" />
                    </div>

                    {/* Agent Status Bubble */}
                    <div className={`pointer-events-auto transition-all duration-500 ease-in-out px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md flex items-center gap-2 ${agentStatus === 'speaking' ? 'bg-blue-500/20 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.3)]' :
                        agentStatus === 'thinking' ? 'bg-purple-500/20 text-purple-200' : 'bg-white/5 text-white/50'
                        }`}>
                        {agentStatus === 'speaking' && (
                            <div className="flex gap-1 items-center h-3">
                                <span className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        )}
                        {agentStatus === 'thinking' && (
                            <div className="flex gap-1 items-center h-3">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        )}
                        <span className="text-xs font-medium tracking-wider uppercase">
                            {agentStatus === 'speaking' ? 'Mimesis is speaking...' : agentStatus === 'thinking' ? 'Mimesis is thinking...' : 'Mimesis is listening...'}
                        </span>
                    </div>
                </header>

                {/* Main Row Wrapper (Left: UI / Right: Data Explorer) */}
                <div className="flex-1 flex flex-row overflow-hidden relative z-10 w-full">

                    {/* Main content area — components render based on agent's visible_components */}
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-8 overflow-y-auto pb-40">

                        {/* ── Zero Gravity Space ────────────────────────────────────────── */}
                        <ZeroGravitySpace onFocusChange={(id) => setFocusedElementId(id)}>
                            {/* 1. The Central Entity (Brand Name & Slogan) */}
                            {(isComponentVisible('brand_name') && state.brand_name) && (
                                <CentralEntity
                                    name={state.brand_name}
                                    slogan={isComponentVisible('brand_slogan') ? state.brand_slogan : undefined}
                                />
                            )}

                            {/* 2. Style Keywords Orbiting */}
                            {(state.style_keywords && state.style_keywords.length > 0) && (
                                <FloatingGroup
                                    id="group-keywords"
                                    title="Keywords"
                                    cx={15} cy={35} radius={140}
                                    items={state.style_keywords.map((kw, i) => (
                                        <FloatingItem key={`kw-${i}`} id={`kw-${i}`} delay={i * 0.2}>
                                            <div style={{ fontFamily: 'var(--font-google-sans)', fontStyle: 'italic', color: '#fff', fontSize: '1.2rem', fontWeight: 500, textShadow: '0 2px 10px rgba(71, 71, 71, 0.8)' }}>
                                                {kw}
                                            </div>
                                        </FloatingItem>
                                    ))}
                                />
                            )}

                            {/* 3. Brand Symbols */}
                            {(state.brand_symbols && state.brand_symbols.length > 0) && (
                                <FloatingGroup
                                    id="group-symbols"
                                    title="Symbols"
                                    cx={35} cy={18} radius={160}
                                    items={state.brand_symbols.map((sym: any, i: number) => (
                                        <FloatingItem key={`sym-${i}`} id={`sym-${i}`} delay={i * 0.3}>
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 rounded-full border border-white/20 bg-white/5 backdrop-blur-md shadow-xl flex items-center justify-center overflow-hidden">
                                                    {/* Image will go here */}
                                                </div>
                                                <span className="text-white/90 text-[11px] font-medium tracking-wide text-center max-w-[100px] leading-tight drop-shadow-md">
                                                    {sym?.title || sym}
                                                </span>
                                            </div>
                                        </FloatingItem>
                                    ))}
                                />
                            )}

                            {/* 4. Strategy */}
                            {(state.brand_strategy && state.brand_strategy.length > 0) && (
                                <FloatingGroup
                                    id="group-strategy"
                                    title="Strategy"
                                    cx={65} cy={22} radius={180}
                                    items={state.brand_strategy.map((strat: any, i: number) => (
                                        <FloatingItem key={`strategy-${i}`} id={`strategy-${i}`} delay={i * 0.2}>
                                            <div className="flex flex-col items-center gap-0.5 bg-black/40 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl w-[160px] hover:bg-black/60 transition-colors">
                                                <span className="text-white/90 text-sm font-medium text-left leading-snug">
                                                    {strat?.title || strat}
                                                </span>
                                                <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold cursor-pointer hover:text-white/80 transition-colors mt-1">
                                                    Click for deep dive
                                                </span>
                                            </div>
                                        </FloatingItem>
                                    ))}
                                />
                            )}

                            {/* 5. Mission */}
                            {(state.brand_mission && state.brand_mission.length > 0) && (
                                <FloatingGroup
                                    id="group-mission"
                                    title="Mission"
                                    cx={20} cy={75} radius={150}
                                    items={state.brand_mission.map((mission: string, i: number) => (
                                        <FloatingItem key={`mission-${i}`} id={`mission-${i}`} delay={i * 0.3}>
                                            <div style={{ fontFamily: 'var(--font-google-sans)', fontStyle: 'italic', color: '#fff', fontSize: '1.2rem', fontWeight: 500, textShadow: '0 2px 10px rgba(71, 71, 71, 0.8)' }} className="w-[150px] text-center leading-tight">
                                                {mission}
                                            </div>
                                        </FloatingItem>
                                    ))}
                                />
                            )}

                            {/* 6. Common Enemy */}
                            {(state.brand_common_enemy && state.brand_common_enemy.length > 0) && (
                                <FloatingGroup
                                    id="group-enemy"
                                    title="Common Enemy"
                                    cx={45} cy={80} radius={150}
                                    items={state.brand_common_enemy.map((enemy: string, i: number) => (
                                        <FloatingItem key={`enemy-${i}`} id={`enemy-${i}`} delay={i * 0.4}>
                                            <div style={{ fontFamily: 'var(--font-google-sans)', fontStyle: 'italic', color: '#fff', fontSize: '1.2rem', fontWeight: 500, textShadow: '0 2px 10px rgba(71, 71, 71, 0.8)' }} className="w-[150px] text-center leading-tight">
                                                {enemy}
                                            </div>
                                        </FloatingItem>
                                    ))}
                                />
                            )}

                            {/* 7. Last News */}
                            {(state.brand_last_news && state.brand_last_news.length > 0) && (
                                <FloatingGroup
                                    id="group-news"
                                    title="News"
                                    cx={82} cy={75} radius={180}
                                    items={state.brand_last_news.map((news: any, i: number) => (
                                        <FloatingItem key={`news-${i}`} id={`news-${i}`} delay={i * 0.25}>
                                            <div className="flex flex-col justify-between bg-black p-4 rounded-xl w-[240px] h-[100px] text-left">
                                                <div className="flex items-start justify-between gap-2 overflow-hidden w-full">
                                                    <span className="text-white text-lg font-medium tracking-tight leading-snug line-clamp-3" style={{ fontFamily: 'var(--font-google-sans)' }}>
                                                        {news?.title || news}
                                                    </span>
                                                    <ExternalLink className="w-4 h-4 text-white shrink-0 mt-1" />
                                                </div>
                                                {news?.summary && (
                                                    <span className="text-[#898989] text-sm leading-snug truncate whitespace-nowrap block w-full text-left" style={{ fontFamily: 'var(--font-google-sans)' }}>
                                                        {news.summary}
                                                    </span>
                                                )}
                                            </div>
                                        </FloatingItem>
                                    ))}
                                />
                            )}

                            {/* 8. Viral Campaigns */}
                            {(state.brand_viral_campaign && state.brand_viral_campaign.length > 0) && (
                                <FloatingGroup
                                    id="group-campaigns"
                                    title=""
                                    cx={82} cy={44} radius={0}
                                    items={[(
                                        <FloatingItem key="campaigns-list" id="campaigns-list">
                                            <div className="flex gap-4 items-stretch">
                                                {/* Left-Aligned Elements Container */}
                                                <div className="flex flex-col items-start gap-1 py-1">
                                                    {/* Custom Title aligned with items */}
                                                    <h3 style={{ fontFamily: 'var(--font-google-sans)', color: '#fff', fontSize: '2.5rem', fontWeight: 600, letterSpacing: '-1.5px' }} className="leading-none text-left mb-2">
                                                        Campaigns
                                                    </h3>

                                                    {/* Items List */}
                                                    <div className="flex flex-col gap-2 items-start mt-1">
                                                        {state.brand_viral_campaign.map((camp: string, i: number) => (
                                                            <div key={i} className="group cursor-pointer text-left opacity-90 hover:opacity-100 transition-opacity whitespace-nowrap">
                                                                <span style={{ fontFamily: 'var(--font-google-sans)' }} className="text-white text-[1.4rem] italic tracking-tight leading-tight">
                                                                    {camp}
                                                                </span>
                                                                <ExternalLink className="inline-block w-[18px] h-[18px] text-white stroke-[2.5px] ml-3 mb-1 shrink-0" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </FloatingItem>
                                    )]}
                                />
                            )}
                        </ZeroGravitySpace>

                        {/* Summary Left Panel */}
                        <div
                            className={`absolute left-10 top-1/2 -translate-y-1/2 w-[340px] bg-black/60 backdrop-blur-3xl border border-white/10 p-6 rounded-2xl shadow-2xl text-left transition-all duration-700 pointer-events-none z-50 ${hasSummaryToDisplay ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
                        >
                            {hasSummaryToDisplay && (
                                <>
                                    <h3 style={{ fontFamily: 'var(--font-google-sans)' }} className="text-white text-xl font-medium tracking-tight mb-4 leading-snug">
                                        {focusedNewsItem.title || "News"}
                                    </h3>
                                    <p style={{ fontFamily: 'var(--font-google-sans)' }} className="text-#898989 text-[1rem] leading-relaxed text-[#898989]">
                                        {focusedNewsItem.summary}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                    {/* Right Data Sidebar — displays all raw agent state */}
                    {isExplorerOpen ? (
                        <div className="w-[350px] shrink-0 bg-black backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto pb-40 flex flex-col gap-6 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
                            <div className="sticky top-0 bg-black pb-4 z-10 border-b border-white/10 mb-2 flex items-center justify-between">
                                <h2 className="text-white/50 uppercase tracking-widest text-xs font-semibold">
                                    Agent State Explorer
                                </h2>
                                <button
                                    onClick={() => setIsExplorerOpen(false)}
                                    className="text-white/40 hover:text-white transition-colors cursor-pointer"
                                    title="Close Explorer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-6 text-left">
                                {Object.entries(state)
                                    .filter(([key]) => key !== 'visible_components')
                                    .map(([key, value]) => {
                                        if (value === undefined || value === null || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0)) return null;

                                        return (
                                            <div key={key} className="flex flex-col gap-1.5" style={{ animation: 'fadeIn 0.5s ease-out forwards' }}>
                                                <span className="text-white/40 text-[10px] uppercase font-mono tracking-wider">{key}</span>
                                                {typeof value === 'object' ? (
                                                    Array.isArray(value) ? (
                                                        <div className="flex flex-col gap-2">
                                                            {value.map((item, i) => (
                                                                <div key={i} className="text-white/90 text-sm bg-white/5 rounded-md p-3 border border-white/5">
                                                                    {typeof item === 'object' ? (
                                                                        <div className="flex flex-col gap-1">
                                                                            {Object.entries(item).map(([k, v]) => (
                                                                                <span key={k} className="leading-relaxed"><strong className="text-white/50 font-normal capitalize">{k}:</strong> {String(v)}</span>
                                                                            ))}
                                                                        </div>
                                                                    ) : <span className="leading-relaxed">{item}</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-2 pl-3 border-l-2 border-white/10 py-1">
                                                            {Object.entries(value).map(([subKey, subValue]) => (
                                                                <div key={subKey} className="text-white/90 text-sm leading-relaxed">
                                                                    <span className="text-white/50 italic mr-2 capitalize">{subKey}:</span>
                                                                    {subValue as React.ReactNode}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="text-white/90 text-sm font-medium leading-relaxed">{String(value)}</div>
                                                )}
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </div>
                    ) : null}

                    {/* Right JSON Raw Panel */}
                    {isJsonOpen ? (
                        <div className="w-[450px] shrink-0 bg-black backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto pb-40 flex flex-col gap-4 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
                            <div className="sticky top-0 bg-black pb-4 z-10 border-b border-white/10 mb-2 flex items-center justify-between">
                                <h2 className="text-white/50 uppercase tracking-widest text-xs font-semibold">
                                    Raw JSON State
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(JSON.stringify(state, null, 2));
                                        }}
                                        className="text-white/30 hover:text-white/70 transition-colors cursor-pointer text-[10px] uppercase tracking-wider border border-white/10 rounded px-2 py-1"
                                        title="Copy JSON"
                                    >
                                        Copy
                                    </button>
                                    <button
                                        onClick={() => setIsJsonOpen(false)}
                                        className="text-white/40 hover:text-white transition-colors cursor-pointer"
                                        title="Close JSON View"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            <pre
                                className="text-[12px] font-mono leading-relaxed text-green-300/90 bg-white/[0.03] rounded-lg p-4 border border-white/5 overflow-x-auto whitespace-pre-wrap break-words"
                                style={{ tabSize: 2 }}
                            >
                                {JSON.stringify(state, null, 2)}
                            </pre>
                        </div>
                    ) : null}

                    {/* Toggle buttons — shown when neither panel is open */}
                    {!isExplorerOpen && !isJsonOpen && (
                        <div className="absolute top-6 right-6 z-50 flex flex-col gap-2">
                            <button
                                onClick={() => setIsExplorerOpen(true)}
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-black/50 border border-white/10 text-white/50 hover:text-white hover:bg-black/80 transition-all backdrop-blur-md cursor-pointer shadow-[0_4px_15px_rgba(0,0,0,0.3)]"
                                title="Open Agent State Explorer"
                            >
                                <Database size={18} />
                            </button>
                            <button
                                onClick={() => setIsJsonOpen(true)}
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-black/50 border border-white/10 text-white/50 hover:text-white hover:bg-black/80 transition-all backdrop-blur-md cursor-pointer shadow-[0_4px_15px_rgba(0,0,0,0.3)]"
                                title="Open Raw JSON View"
                            >
                                <Braces size={18} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Voice session bar — fixed at bottom */}
                <div className="fixed bottom-[40px] left-1/2 -translate-x-1/2 z-50">
                    <VoiceSession onStop={() => router.push('/')} onStatusChange={setAgentStatus} />
                </div>

                <style jsx>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        </>
    );
}