"use client"

import React, { createContext, useContext, useCallback } from 'react';
import { AgentState, ComponentId } from '@/types/AgentState';
import { useAgentStateWebSocket } from '@/hooks/useAgentStateWebSocket';

// ─── Context type ───────────────────────────────────────────────────────────

interface AgentStateContextType {
    /** Full agent state — partial updates are merged automatically */
    state: AgentState;
    /** Whether the state WebSocket is connected */
    isConnected: boolean;
    /** Session ID being tracked */
    sessionId: string | null;
    /** Connect to a session's state stream */
    connectToSession: (sessionId: string) => void;
    /** Disconnect from the state stream */
    disconnect: () => void;
    /** Check if a specific component should be visible */
    isComponentVisible: (componentId: ComponentId) => boolean;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AgentStateContext = createContext<AgentStateContextType | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────────────────────

export function AgentStateProvider({ children }: { children: React.ReactNode }) {
    const {
        state,
        isConnected,
        sessionId,
        connectToSession,
        disconnect
    } = useAgentStateWebSocket();

    /**
     * Check if a component should be visible based on agent's `visible_components`.
     *
     * Rules:
     * - If `visible_components` is undefined/empty → show everything (default)
     * - If `visible_components` includes "all" → show everything EXCEPT uploaded_images
     * - `uploaded_images` is a special case: only visible when explicitly listed
     * - Otherwise → only show if the component ID is in the list
     */
    const isComponentVisible = useCallback((componentId: ComponentId): boolean => {
        const vc = state.visible_components;

        // Special: uploaded_images must ALWAYS be explicitly listed
        if (componentId === 'uploaded_images') {
            return vc?.includes('uploaded_images') ?? false;
        }

        // No layout set yet → show all by default
        if (!vc || vc.length === 0) return true;

        // "all" shortcut (excludes uploaded_images, handled above)
        if (vc.includes('all')) return true;

        // Check if this specific component is in the list
        return vc.includes(componentId);
    }, [state.visible_components]);

    return (
        <AgentStateContext.Provider
            value={{
                state,
                isConnected,
                sessionId,
                connectToSession,
                disconnect,
                isComponentVisible,
            }}
        >
            {children}
        </AgentStateContext.Provider>
    );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAgentState() {
    const ctx = useContext(AgentStateContext);
    if (!ctx) throw new Error('useAgentState must be used within AgentStateProvider');
    return ctx;
}
