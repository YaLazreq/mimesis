"use client"

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAgentState } from './AgentStateContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BrandTheme {
    brandName: string;
    brandSlogan?: string;
    primaryColor: string[];
    secondaryColor: string[];
    fontFamily: string[];
    styleKeywords: string[];
    logoDescription: string;
}

interface MimesisThemeContextType {
    /** Current brand theme — null means default/black */
    theme: BrandTheme | null;

    /** Update the entire brand theme (manual override, if needed) */
    updateTheme: (theme: BrandTheme) => void;

    /** Reset to default black state */
    resetTheme: () => void;

    /** Whether a theme transition is in progress */
    isTransitioning: boolean;
}

// ─── Context ───────────────────────────────────────────────────────────────

const MimesisThemeContext = createContext<MimesisThemeContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────

export function MimesisThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<BrandTheme | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ── Bridge: sync AgentState → MimesisTheme ─────────────────────────
    // When agent state receives color/brand data, automatically update
    // the theme so AnimatedBackground and other visual components react.
    const { state: agentState } = useAgentState();

    useEffect(() => {
        const hasColors = agentState.primary_color && agentState.primary_color.length > 0;
        if (!hasColors && !agentState.brand_name) {
            if (theme !== null) {
                console.log("[MimesisTheme] 🧹 AgentState cleared, resetting theme to default");
                setTheme(null);
            }
            return;
        }

        const newTheme: BrandTheme = {
            brandName: agentState.brand_name || '',
            brandSlogan: agentState.brand_slogan || '',
            primaryColor: agentState.primary_color || [],
            secondaryColor: agentState.secondary_color || [],
            fontFamily: agentState.font_family || [],
            styleKeywords: agentState.style_keywords || [],
            logoDescription: agentState.logo_description || '',
        };

        console.log("[MimesisTheme] 🔄 Auto-synced from AgentState:", newTheme.brandName);
        setIsTransitioning(true);
        setTheme(newTheme);

        if (transitionTimeoutRef.current) {
            clearTimeout(transitionTimeoutRef.current);
        }
        transitionTimeoutRef.current = setTimeout(() => {
            setIsTransitioning(false);
        }, 2000);
    }, [
        agentState.brand_name,
        agentState.brand_slogan,
        agentState.primary_color,
        agentState.secondary_color,
        agentState.font_family,
        agentState.style_keywords,
        agentState.logo_description,
    ]);

    // ── Manual overrides (kept for flexibility) ────────────────────────

    const updateTheme = useCallback((newTheme: BrandTheme) => {
        console.log("[MimesisTheme] 🎨 Manual theme update:", newTheme.brandName);
        setIsTransitioning(true);
        setTheme(newTheme);

        if (transitionTimeoutRef.current) {
            clearTimeout(transitionTimeoutRef.current);
        }
        transitionTimeoutRef.current = setTimeout(() => {
            setIsTransitioning(false);
        }, 2000);
    }, []);

    const resetTheme = useCallback(() => {
        console.log("[MimesisTheme] ♻️ Resetting to default");
        setIsTransitioning(true);
        setTheme(null);

        if (transitionTimeoutRef.current) {
            clearTimeout(transitionTimeoutRef.current);
        }
        transitionTimeoutRef.current = setTimeout(() => {
            setIsTransitioning(false);
        }, 2000);
    }, []);

    return (
        <MimesisThemeContext.Provider value={{ theme, updateTheme, resetTheme, isTransitioning }}>
            {children}
        </MimesisThemeContext.Provider>
    );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useMimesisTheme() {
    const context = useContext(MimesisThemeContext);
    if (context === undefined) {
        throw new Error('useMimesisTheme must be used within a MimesisThemeProvider');
    }
    return context;
}
