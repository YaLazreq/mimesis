"use client"

import { useRouter } from 'next/navigation';
import { typography, colors } from "./designSystem";
import VoiceWakeUp from "@/components/voice/VoiceWakeUp";

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-zinc-50 dark:bg-black gap-2">
      <h1 style={typography.welcomeTitle}>Mimesis</h1>

      <p style={{ ...typography.bodyLarge, color: colors.text.secondary }}>
        Production Studio
      </p>

      <div className="fixed bottom-[40px]">
        <VoiceWakeUp onActivated={() => router.push('/studio')} />
      </div>

    </div>
  );
}
