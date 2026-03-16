"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { typography, colors } from "./designSystem";
import VoiceWakeUp from "@/components/voice/VoiceWakeUp";
import AudioPermissionGate from "@/components/voice/AudioPermissionGate";

export default function Home() {
  const router = useRouter();
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-zinc-50 dark:bg-black gap-2">
      {/* Permission gate — blocks everything until mic+audio are activated */}
      {!audioUnlocked && (
        <AudioPermissionGate onGranted={() => setAudioUnlocked(true)} />
      )}

      <h1 style={typography.welcomeTitle}>Mimesis</h1>

      <p style={{ ...typography.bodyLarge, color: colors.text.secondary }}>
        Production Studio
      </p>

      <div className="fixed bottom-[40px]">
        {audioUnlocked && (
          <VoiceWakeUp onActivated={() => router.push('/studio')} />
        )}
      </div>

    </div>
  );
}
