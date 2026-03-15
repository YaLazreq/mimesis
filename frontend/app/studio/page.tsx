"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { typography } from "../designSystem";
import VoiceSession from "@/components/voice/VoiceSession";
import AnimatedBackground from "@/components/background/AnimatedBackground";
import InfoBadge from "@/components/ui/InfoBadge";
import { useAgentState } from "@/contexts/AgentStateContext";
import { X, Database, Braces } from 'lucide-react';

export default function StudioPage() {
    const router = useRouter();
    const { state, isComponentVisible } = useAgentState();
    const [isExplorerOpen, setIsExplorerOpen] = useState(false);
    const [isJsonOpen, setIsJsonOpen] = useState(false);
    const [agentStatus, setAgentStatus] = useState<'listening' | 'speaking' | 'thinking'>('listening');

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
                <header className="flex items-center justify-between p-6 shrink-0 relative z-10">
                    <div className="flex items-center gap-2">
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
                    <div className={`transition-all duration-500 ease-in-out px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md flex items-center gap-2 ${
                        agentStatus === 'speaking' ? 'bg-blue-500/20 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 
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

                    {/* ── Brand Name ──────────────────────────────────── */}
                    {isComponentVisible('brand_name') && state.brand_name && (
                        <div style={{ animation: 'fadeIn 1s ease-out forwards' }}>
                            <h2 
                                style={{
                                    ...typography.welcomeTitle,
                                    color: '#FFFFFF',
                                    fontSize: '5rem',
                                    textShadow: '0 4px 30px rgba(0,0,0,0.5)'
                                }}
                            >
                                {state.brand_name}
                            </h2>
                        </div>
                    )}

                    {/* ── Brand Slogan ──────────────────────────────────── */}
                    {isComponentVisible('brand_slogan') && state.brand_slogan && (
                        <div style={{ animation: 'fadeIn 0.8s ease-out forwards' }}>
                            <p 
                                style={{
                                    ...typography.bodyLarge,
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    fontSize: '1.5rem',
                                    maxWidth: '600px',
                                    textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                                }}
                            >
                                {state.brand_slogan}
                            </p>
                        </div>
                    )}

                    {/* ── Brand Symbols ──────────────────────────── */}
                    {isComponentVisible('brand_symbols') && state.brand_symbols && state.brand_symbols.length > 0 && (
                        <div style={{ animation: 'fadeIn 0.8s ease-out forwards' }}>
                            <p style={{
                                color: 'rgba(255, 255, 255, 0.6)',
                                fontSize: '1rem',
                                fontStyle: 'italic',
                            }}>
                                ❖ {state.brand_symbols.join(' · ')}
                            </p>
                        </div>
                    )}

                    {/* ── Style Keywords ────────────────────────────────── */}
                    {isComponentVisible('style_keywords') && state.style_keywords && state.style_keywords.length > 0 && (
                        <div style={{ animation: 'fadeIn 0.8s ease-out forwards' }}>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {state.style_keywords.map((kw, i) => (
                                    <span key={i} style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '20px',
                                        padding: '6px 14px',
                                        color: 'rgba(255,255,255,0.75)',
                                        fontSize: '0.8rem',
                                        letterSpacing: '0.5px',
                                        backdropFilter: 'blur(4px)',
                                    }}>
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Brand Mission ──────────────────────────────────── */}
                    {isComponentVisible('brand_mission') && state.brand_mission && (
                        <div style={{ animation: 'fadeIn 0.8s ease-out forwards' }}>
                            <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                                Mission
                            </h3>
                            <p style={{
                                color: 'rgba(255, 255, 255, 0.85)',
                                fontSize: '1.1rem',
                                maxWidth: '500px',
                            }}>
                                {state.brand_mission}
                            </p>
                        </div>
                    )}

                    {/* ── Brand Common Enemy ────────────────────────────── */}
                    {isComponentVisible('brand_common_enemy') && state.brand_common_enemy && state.brand_common_enemy.length > 0 && (
                        <div style={{ animation: 'fadeIn 0.8s ease-out forwards' }}>
                            <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                                Enemy
                            </h3>
                            <p style={{
                                color: 'rgba(255, 255, 255, 0.85)',
                                fontSize: '1.1rem',
                            }}>
                                {state.brand_common_enemy.join(' · ')}
                            </p>
                        </div>
                    )}

                    {/* ── Brand Strategy ────────────────────────────────── */}
                    {isComponentVisible('brand_strategy') && state.brand_strategy && (
                        <div style={{ animation: 'fadeIn 0.8s ease-out forwards' }}>
                            <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                                Strategy
                            </h3>
                            <p style={{
                                color: 'rgba(255, 255, 255, 0.85)',
                                fontSize: '1.1rem',
                                maxWidth: '500px',
                            }}>
                                {state.brand_strategy}
                            </p>
                        </div>
                    )}

                    {/* ── Brand News ────────────────────────────────────── */}
                    {isComponentVisible('brand_last_news') && state.brand_last_news && state.brand_last_news.length > 0 && (
                        <div style={{ animation: 'fadeIn 0.8s ease-out forwards', maxWidth: '600px', width: '100%' }}>
                            <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>
                                Latest News
                            </h3>
                            <div className="flex flex-col gap-3">
                                {state.brand_last_news.map((news, i) => (
                                    <div key={i} style={{
                                        background: 'rgba(255,255,255,0.08)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        backdropFilter: 'blur(10px)',
                                        textAlign: 'left',
                                    }}>
                                        <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600, marginBottom: '4px' }}>
                                            {news.title}
                                        </h4>
                                        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                                            {news.summary}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Viral Campaign ────────────────────────────────── */}
                    {isComponentVisible('brand_viral_campaign') && state.brand_viral_campaign && state.brand_viral_campaign.length > 0 && (
                        <div style={{ animation: 'fadeIn 0.8s ease-out forwards' }}>
                            <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
                                Iconic Campaign
                            </h3>
                            {state.brand_viral_campaign.map((campaign, i) => (
                                <p key={i} style={{
                                    color: 'rgba(255, 255, 255, 0.85)',
                                    fontSize: '1.1rem',
                                    maxWidth: '500px',
                                }}>
                                    {campaign}
                                </p>
                            ))}
                        </div>
                    )}

                    {/* ── Creative Angle ────────────────────────────────── */}
                    {isComponentVisible('brand_creative_angle') && state.brand_creative_angle && (
                        <div style={{ animation: 'fadeIn 0.8s ease-out forwards', maxWidth: '500px' }}>
                            <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>
                                Creative Angle
                            </h3>
                            <div className="flex flex-col gap-2 text-left">
                                {state.brand_creative_angle.poetry && (
                                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                                        📜 <strong>Poetry:</strong> {state.brand_creative_angle.poetry}
                                    </p>
                                )}
                                {state.brand_creative_angle.painting && (
                                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                                        🎨 <strong>Painting:</strong> {state.brand_creative_angle.painting}
                                    </p>
                                )}
                                {state.brand_creative_angle.music && (
                                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                                        🎵 <strong>Music:</strong> {state.brand_creative_angle.music}
                                    </p>
                                )}
                                {state.brand_creative_angle.metaphor && (
                                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                                        💡 <strong>Metaphor:</strong> {state.brand_creative_angle.metaphor}
                                    </p>
                                )}
                                {state.brand_creative_angle.cinema && (
                                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                                        🎬 <strong>Cinema:</strong> {state.brand_creative_angle.cinema}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
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