/**
 * Wake word matching logic for "Hey Mimesis".
 *
 * Since "Mimesis" is Greek and not in the English speech recognizer's
 * vocabulary, it gets transcribed as common English words. This module
 * matches against known mis-transcriptions using two tiers:
 *
 *   - UNIQUE_PHRASES:   Distinctive enough to match anywhere in transcript
 *   - PREFIXED_PHRASES: Generic phrases that require a "hey" prefix to
 *                        avoid false positives from everyday speech
 */

// Phrases unique enough to match anywhere in the transcript
const UNIQUE_PHRASES = [
    'mimesis', 'nemesis', 'mimeses', 'nemeses',
    'mimicis', 'memesis', 'mymesis',
    'my missus', 'my mrs', 'my misses',
    'me missus', 'me mrs', 'me misses',
    'payment is', 'payment is this',
];

// Generic phrases that could be normal speech — only match with a "hey" prefix
const PREFIXED_PHRASES = [
    'my name is', 'my name is this',
    'name is', 'name is this',
];

/**
 * Check if a transcript matches the wake word "Hey Mimesis".
 * Handles common English mis-transcriptions of the Greek word.
 */
export function matchesWakeWord(transcript: string): boolean {
    const t = transcript.toLowerCase().trim();

    // Check unique phrases anywhere
    if (UNIQUE_PHRASES.some(p => t.includes(p))) return true;

    // Check generic phrases only if preceded by "hey"
    if (PREFIXED_PHRASES.some(p => t.includes(p))) {
        const heyIndex = t.indexOf('hey');
        if (heyIndex !== -1) {
            const phraseIndex = PREFIXED_PHRASES.reduce((earliest, p) => {
                const idx = t.indexOf(p);
                return idx !== -1 && idx < earliest ? idx : earliest;
            }, t.length);
            if (heyIndex < phraseIndex) return true;
        }
    }

    return false;
}
