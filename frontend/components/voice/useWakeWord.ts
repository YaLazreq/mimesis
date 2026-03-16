import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpeechRecognition, SpeechRecognitionEvent } from './types/speech-recognition';
import { matchesWakeWord } from './wakeWord';

interface UseWakeWordOptions {
    /** Called when the wake word is detected */
    onDetected: () => void;
    /** Whether wake word detection should be active */
    enabled?: boolean;
}

interface UseWakeWordReturn {
    /** Whether the wake word recognizer is actively listening */
    isActive: boolean;
    /** Manually start wake word detection */
    start: () => void;
    /** Manually stop wake word detection */
    stop: () => void;
}

/**
 * Hook that listens for the "Hey Mimesis" wake word using the
 * Web Speech API. Automatically restarts on silence/errors.
 */
export function useWakeWord({ onDetected, enabled = true }: UseWakeWordOptions): UseWakeWordReturn {
    const [isActive, setIsActive] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const shouldRestartRef = useRef(true);
    const onDetectedRef = useRef(onDetected);

    // Keep callback ref fresh without restarting recognition
    useEffect(() => {
        onDetectedRef.current = onDetected;
    }, [onDetected]);

    const stop = useCallback(() => {
        shouldRestartRef.current = false;
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }
        setIsActive(false);
    }, []);

    const start = useCallback(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            console.warn('Speech Recognition API not supported in this browser.');
            return;
        }

        // Clean up any existing instance
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.abort();
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 3;

        shouldRestartRef.current = true;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                for (let j = 0; j < result.length; j++) {
                    const transcript = result[j].transcript.toLowerCase().trim();

                    // Debug: log every transcript
                    console.log(
                        `[Wake Word] ${result.isFinal ? 'FINAL' : 'interim'}: "${transcript}" (confidence: ${(result[j].confidence * 100).toFixed(1)}%)`
                    );

                    if (matchesWakeWord(transcript)) {
                        console.log(`✅ Wake word detected: "${result[j].transcript}"`);
                        recognition.onend = null;
                        recognition.abort();
                        recognitionRef.current = null;
                        setIsActive(false);
                        onDetectedRef.current();
                        return;
                    }
                }
            }
        };

        recognition.onerror = (event: Event & { error: string }) => {
            if (event.error === 'no-speech' || event.error === 'aborted') return;
            console.warn('Speech recognition error:', event.error);
            // Stop retrying on fatal errors — mic not available or blocked
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
                console.warn('[WakeWord] Mic not available, stopping wake word detection. Use click instead.');
                shouldRestartRef.current = false;
                setIsActive(false);
            }
        };

        recognition.onend = () => {
            // Auto-restart unless intentionally stopped
            if (shouldRestartRef.current) {
                try {
                    recognition.start();
                } catch {
                    setTimeout(() => {
                        if (shouldRestartRef.current) {
                            try { recognition.start(); } catch { /* ignore */ }
                        }
                    }, 300);
                }
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
            setIsActive(true);
        } catch (err) {
            console.error('Failed to start speech recognition:', err);
        }
    }, []);

    // Auto-start/stop based on `enabled` prop
    useEffect(() => {
        if (enabled) {
            start();
        } else {
            stop();
        }

        return () => {
            shouldRestartRef.current = false;
            if (recognitionRef.current) {
                recognitionRef.current.onend = null;
                recognitionRef.current.abort();
                recognitionRef.current = null;
            }
        };
    }, [enabled, start, stop]);

    return { isActive, start, stop };
}
