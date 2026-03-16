import { useEffect, useRef } from 'react';
import { useAgentState } from '@/contexts/AgentStateContext';
import { setVoiceSocket } from './voiceSocket';

export interface UseVoiceAudioProps {
    onStatusChange?: (status: 'listening' | 'speaking' | 'thinking') => void;
}

export function useVoiceAudio({ onStatusChange }: UseVoiceAudioProps = {}) {
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayTimeRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const dataArrayFreqRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const playerNodeRef = useRef<AudioWorkletNode | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { connectToSession, disconnect: disconnectState } = useAgentState();
    const connectToSessionRef = useRef(connectToSession);
    connectToSessionRef.current = connectToSession;

    useEffect(() => {
        let isMounted = true;
        let recorderAudioContext: AudioContext | null = null;
        let playerAudioContext: AudioContext | null = null;
        let localStream: MediaStream | null = null;
        let recorderNode: AudioWorkletNode | null = null;

        const userId = "demo_user_" + Math.random().toString(36).substring(7);
        const sessionId = "demo_session_" + Math.random().toString(36).substring(7);

        connectToSessionRef.current(sessionId);

        const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
        let cleanBaseUrl = baseUrl.endsWith('/ws') ? baseUrl.slice(0, -3) : baseUrl;
        cleanBaseUrl = cleanBaseUrl.endsWith('/') ? cleanBaseUrl.slice(0, -1) : cleanBaseUrl;
        const wsUrl = `${cleanBaseUrl}/ws/${userId}/${sessionId}`;

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;
        setVoiceSocket(ws);

        ws.onopen = () => {
            console.log("WebSocket connected ✅", wsUrl);
            ws.send(JSON.stringify({
                type: 'text',
                text: 'System: The user has just entered the studio. Please greet the team warmly unconditionally and ask what brand we are working on today.'
            }));
        };

        ws.onerror = () => {
            console.warn("WebSocket ⚠️  error (see onclose for details)");
        };

        ws.onclose = (ev) => {
            console.log("WebSocket closed", ev.code, ev.reason);
        };

        const pendingAudioBuffers: ArrayBuffer[] = [];
        let eventCount = 0;
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                eventCount++;

                if (eventCount <= 5) {
                    console.log(`[ADK Event #${eventCount} FULL]`, JSON.stringify(data).substring(0, 800));
                }

                if (data.inputTranscription) {
                    console.log("[🎤 You said]", data.inputTranscription.text);
                    if (data.turnComplete) {
                        onStatusChange?.('thinking');
                    }
                }
                
                if (data.interrupted || data.serverContent?.interrupted) {
                    console.log("🛑 [Audio] Interrupted by user! Clearing buffer.");
                    if (playerNodeRef.current) {
                        playerNodeRef.current.port.postMessage({ command: 'endOfAudio' });
                    }
                    pendingAudioBuffers.length = 0;
                    onStatusChange?.('listening');
                }
                if (data.outputTranscription) {
                    console.log("[🤖 Gemini said]", data.outputTranscription.text);
                    onStatusChange?.('speaking');
                    
                    // Clear any existing timeout
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    
                    // In a real app we'd wait for end of audio, but a simple heuristic is fine:
                    // we'll reset to listening ~3s after transcription unless interrupted/more text arrives.
                    timeoutRef.current = setTimeout(() => {
                        onStatusChange?.('listening');
                    }, 4000);
                }

                const parts = data.content?.parts
                    || data.serverContent?.modelTurn?.parts
                    || [];

                if (parts.length > 0) {
                    const partKeys = parts.map((p: any) => Object.keys(p));
                    console.log(`[Content] ${parts.length} part(s), keys:`, partKeys);
                }

                parts.forEach((part: any) => {
                    const inlineData = part.inlineData || part.inline_data;

                    if (inlineData?.data) {
                        onStatusChange?.('speaking');
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        timeoutRef.current = setTimeout(() => {
                            onStatusChange?.('listening');
                        }, 4000);

                        const base64Data = inlineData.data
                            .replace(/-/g, '+')
                            .replace(/_/g, '/');
                        const mimeType = inlineData.mimeType || inlineData.mime_type || 'unknown';

                        const binaryString = window.atob(base64Data);
                        const len = binaryString.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }

                        if (playerNodeRef.current) {
                            playerNodeRef.current.port.postMessage(bytes.buffer);
                        } else {
                            pendingAudioBuffers.push(bytes.buffer);
                            console.log("[Audio] Buffered chunk, player not ready yet");
                        }
                    }

                    if (part.text) {
                        console.log("[Gemini Text]", part.text);
                        // Usually system texts
                    }
                });

                if (data.turnComplete) {
                    console.log("[Turn Complete] ✅");
                }
            } catch {
                // Non-JSON or unexpected format — ignore
            }
        };

        const setupAudio = async () => {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });
                if (!isMounted) {
                    localStream.getTracks().forEach(t => t.stop());
                    return;
                }

                recorderAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                    sampleRate: 16000,
                });
                audioContextRef.current = recorderAudioContext;

                playerAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                    sampleRate: 24000,
                });

                await Promise.all([
                    recorderAudioContext.state === 'suspended' ? recorderAudioContext.resume() : Promise.resolve(),
                    playerAudioContext.state === 'suspended' ? playerAudioContext.resume() : Promise.resolve(),
                ]);
                console.log("AudioContexts resumed ▶️ (recorder: 16kHz, player: 24kHz)");

                await Promise.all([
                    recorderAudioContext.audioWorklet.addModule('/pcm/pcm-recorder-processor.js'),
                    playerAudioContext.audioWorklet.addModule('/pcm/pcm-player-processor.js'),
                ]);
                if (!isMounted) return;

                recorderNode = new AudioWorkletNode(recorderAudioContext, 'pcm-recorder-processor');
                const micSource = recorderAudioContext.createMediaStreamSource(localStream);
                micSource.connect(recorderNode);

                recorderNode.port.onmessage = (event) => {
                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                        socketRef.current.send(event.data);
                    }
                };

                const playerNode = new AudioWorkletNode(playerAudioContext, 'pcm-player-processor');
                playerNode.connect(playerAudioContext.destination);
                playerNodeRef.current = playerNode;
                console.log("Player worklet connected to speakers 🔊");

                if (pendingAudioBuffers.length > 0) {
                    console.log(`[Audio] Flushing ${pendingAudioBuffers.length} buffered chunks`);
                    for (const buf of pendingAudioBuffers) {
                        playerNode.port.postMessage(buf);
                    }
                    pendingAudioBuffers.length = 0;
                }

                mediaStreamRef.current = localStream;
                const analyser = recorderAudioContext.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.8;
                micSource.connect(analyser);
                analyserRef.current = analyser;
                dataArrayTimeRef.current = new Uint8Array(analyser.frequencyBinCount);
                dataArrayFreqRef.current = new Uint8Array(analyser.frequencyBinCount);

            } catch (err) {
                console.error("Audio setup error:", err);
            }
        };

        setupAudio();

        return () => {
            isMounted = false;
            disconnectState();
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            setVoiceSocket(null);
            if (recorderNode) {
                recorderNode.disconnect();
            }
            if (playerNodeRef.current) {
                playerNodeRef.current.disconnect();
                playerNodeRef.current = null;
            }
            if (localStream) {
                localStream.getTracks().forEach(t => t.stop());
            }
            if (recorderAudioContext) {
                recorderAudioContext.close();
            }
            if (playerAudioContext) {
                playerAudioContext.close();
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        mediaStreamRef,
        analyserRef,
        dataArrayTimeRef,
        dataArrayFreqRef
    };
}
