"use client"

import { useRouter } from 'next/navigation';
import { typography, colors } from "../designSystem";
import VoiceSession from "@/components/voice/VoiceSession";

export default function StudioPage() {
    const router = useRouter();

    return (
        <div
            className="flex flex-col min-h-screen items-center justify-center"
            style={{ background: colors.background.primary }}
        >
            <h1 style={typography.welcomeTitle}>Mimesis</h1>

            <p style={{ ...typography.bodyLarge, color: colors.text.secondary }}>
                Listening...
            </p>

            <div className="fixed bottom-[40px]">
                <VoiceSession onStop={() => router.push('/')} />
            </div>

        </div>
    );
}