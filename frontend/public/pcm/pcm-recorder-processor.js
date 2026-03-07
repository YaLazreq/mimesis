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

        // Convert Float32 [-1, 1] → Int16 [-32768, 32767]
        const int16 = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
            const s = Math.max(-1, Math.min(1, channelData[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send raw PCM bytes to the main thread
        this.port.postMessage(int16.buffer, [int16.buffer]);

        return true;
    }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
