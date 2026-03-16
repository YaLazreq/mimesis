import { useState, useRef, useCallback, useEffect } from 'react';
import { AgentState } from '@/types/AgentState';

export function useAgentStateWebSocket() {
    const [state, setState] = useState<AgentState>({});
    const [isConnected, setIsConnected] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const intentionalCloseRef = useRef(false);

    const _openWs = (sid: string) => {
        if (wsRef.current) {
            intentionalCloseRef.current = true;
            wsRef.current.close();
            wsRef.current = null;
        }

        const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
        const cleanBaseUrl = baseUrl.replace(/\/ws\/?$/, '').replace(/\/$/, '');
        const wsUrl = `${cleanBaseUrl}/ws/state/${sid}`;

        console.log("[AgentState] 🔌 Connecting to:", wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[AgentState] 🟢 Connected:", sid);
            setIsConnected(true);
            intentionalCloseRef.current = false;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'state_snapshot':
                        console.log("[AgentState] 📸 Snapshot:", Object.keys(data.state));
                        setState(data.state);
                        break;
                    case 'state_update':
                        console.log("[AgentState] 🔄 Patch:", Object.keys(data.patch));
                        setState(prev => ({ ...prev, ...data.patch }));
                        break;
                    case 'ui_layout':
                        console.log("[AgentState] 🖼️ Layout:", data.visible_components);
                        setState(prev => ({
                            ...prev,
                            visible_components: data.visible_components,
                        }));
                        break;
                    default:
                        console.log("[AgentState] Unknown event:", data.type);
                }
            } catch (err) {
                console.error("[AgentState] Parse error:", err);
            }
        };

        ws.onclose = (ev) => {
            console.log("[AgentState] 🔴 Closed:", ev.code, ev.reason);
            setIsConnected(false);
            if (!intentionalCloseRef.current && ev.code !== 1000) {
                console.log("[AgentState] 🔄 Will reconnect in 3s...");
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (wsRef.current === null && !intentionalCloseRef.current) {
                        _openWs(sid);
                    }
                }, 3000);
            }
        };

        ws.onerror = () => {
            console.warn("[AgentState] ⚠️  WS error (will reconnect on close)");
        };
    };

    const connectToSession = useCallback((sid: string) => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        setSessionId(prev => {
            if (prev !== sid) {
                console.log("[AgentState] 🆕 New session — resetting state");
                setState({});
            }
            return sid;
        });

        _openWs(sid);
    }, [_openWs]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (wsRef.current) {
            intentionalCloseRef.current = true;
            wsRef.current.close(1000, "intentional");
            wsRef.current = null;
        }
        setIsConnected(false);
        setSessionId(null);
        setState({});
    }, []);

    useEffect(() => {
        return () => {
            intentionalCloseRef.current = true;
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };
    }, []);

    return {
        state,
        isConnected,
        sessionId,
        connectToSession,
        disconnect,
    };
}
