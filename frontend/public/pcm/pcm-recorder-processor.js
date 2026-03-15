/**
 * An AudioWorklet processor that captures microphone PCM input,
 * converts it to 16-bit integers, and sends it to the main thread.
 */
class PCMRecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        const channelData = input[0]; // mono – first channel
        if (!channelData || channelData.length === 0) return true;

        if (!this._buffer) {
            this._buffer = new Int16Array(2048);
            this._bufferIndex = 0;
        }

        // Convert Float32 [-1, 1] → Int16 [-32768, 32767]
        for (let i = 0; i < channelData.length; i++) {
            const s = Math.max(-1, Math.min(1, channelData[i]));
            this._buffer[this._bufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7FFF;

            if (this._bufferIndex >= 2048) {
                const chunk = this._buffer.slice();
                this.port.postMessage(chunk.buffer, [chunk.buffer]);
                this._bufferIndex = 0;
            }
        }

        return true;
    }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
