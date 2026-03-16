/**
 * Shared module-level reference to the voice WebSocket.
 *
 * This allows components outside the VoiceSession tree (e.g. ImageUpload)
 * to send data directly to the Gemini Live model via the existing WebSocket connection.
 */

let _voiceSocket: WebSocket | null = null;

export function getVoiceSocket(): WebSocket | null {
    return _voiceSocket;
}

export function setVoiceSocket(ws: WebSocket | null): void {
    _voiceSocket = ws;
}
