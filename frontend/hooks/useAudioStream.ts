'use client';

const constraints = {
    audio: true,
    video: false,
};

async function useAudioStream() {
    try {
        const stream: MediaStream = await navigator.mediaDevices.getUserMedia(constraints);


    } catch (error) { }

}