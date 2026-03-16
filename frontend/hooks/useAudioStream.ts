'use client';

const constraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
    video: false,
};

async function useAudioStream() {
    try {
        const stream: MediaStream = await navigator.mediaDevices.getUserMedia(constraints);


    } catch (error) { }

}