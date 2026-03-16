"use client"

import React, { useState, useEffect } from 'react';
import { Mic, Volume2, AlertCircle, ArrowRight } from 'lucide-react';

interface AudioPermissionGateProps {
  /** Called once mic + audio are unlocked */
  onGranted: () => void;
}

export default function AudioPermissionGate({ onGranted }: AudioPermissionGateProps) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [permState, setPermState] = useState<string>('unknown');

  // Check current permission state on mount
  useEffect(() => {
    (async () => {
      try {
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setPermState(result.state); // 'granted' | 'denied' | 'prompt'
          console.log('[AudioGate] Mic permission state:', result.state);

          // If already granted, try to activate directly
          if (result.state === 'granted') {
            console.log('[AudioGate] Permission already granted, will auto-activate on click');
          }
        }
      } catch {
        console.log('[AudioGate] Cannot query permissions (browser may not support it)');
      }
    })();
  }, []);

  const handleActivate = async () => {
    setStatus('requesting');
    setErrorMsg('');

    try {
      // 1. Unlock AudioContext (the MAIN purpose of this gate — needs a user gesture on HTTPS)
      console.log('[AudioGate] Creating AudioContext...');
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Play a silent buffer to fully unlock audio output
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      ctx.close();
      console.log('[AudioGate] AudioContext unlocked ✅');

      // 2. Try to get mic permission (best-effort, non-blocking)
      try {
        console.log('[AudioGate] Requesting getUserMedia...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // Release immediately
        console.log('[AudioGate] getUserMedia OK ✅');
      } catch (micErr: any) {
        // Not fatal — the studio page will retry when it needs the mic
        console.warn('[AudioGate] getUserMedia failed (non-fatal):', micErr.name, micErr.message);
      }

      // 3. Proceed regardless — AudioContext is unlocked, that's what matters
      console.log('[AudioGate] ✅ Proceeding to app');
      onGranted();
    } catch (err: any) {
      console.error('[AudioGate] AudioContext error:', err.name, err.message);
      setErrorMsg(`Erreur audio: ${err.name} — ${err.message}`);
      setStatus('error');
    }
  };

  const handleSkip = () => {
    console.log('[AudioGate] User skipped mic+audio activation');
    onGranted();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-8 max-w-md text-center px-6">
        {/* Logo */}
        <h1
          className="text-white tracking-[-2px] leading-none"
          style={{ fontFamily: 'var(--font-google-sans)', fontSize: '3rem', fontWeight: 600 }}
        >
          Mimesis
        </h1>

        <p className="text-white/50 text-sm leading-relaxed">
          Mimesis a besoin d&apos;accéder à votre microphone et vos haut-parleurs pour une expérience vocale interactive.
        </p>

        {/* Permission state indicator */}
        {permState === 'denied' && (
          <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            <span>Le micro est actuellement bloqué par le navigateur. Cliquez sur 🔒 dans la barre d&apos;adresse pour l&apos;autoriser.</span>
          </div>
        )}

        {/* Permission icons */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className={`w-14 h-14 rounded-full border flex items-center justify-center ${
              permState === 'granted' ? 'border-green-400/30 bg-green-400/10' : 'border-white/10 bg-white/5'
            }`}>
              <Mic size={24} className={permState === 'granted' ? 'text-green-400' : 'text-white/70'} />
            </div>
            <span className="text-white/40 text-[11px] uppercase tracking-wider">Micro</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
              <Volume2 size={24} className="text-white/70" />
            </div>
            <span className="text-white/40 text-[11px] uppercase tracking-wider">Son</span>
          </div>
        </div>

        {/* Activate button */}
        <button
          onClick={handleActivate}
          disabled={status === 'requesting'}
          className="px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm tracking-wide
                     hover:bg-white/90 active:scale-95 transition-all cursor-pointer
                     disabled:opacity-50 disabled:cursor-wait
                     shadow-[0_0_30px_rgba(255,255,255,0.15)]"
          style={{ fontFamily: 'var(--font-google-sans)' }}
        >
          {status === 'requesting' ? 'Activation...' : 'Activer Micro & Son'}
        </button>

        {/* Error state — shows actual error */}
        {status === 'error' && (
          <div className="flex flex-col gap-3 items-center">
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-left max-w-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>

            {/* Skip button — lets user proceed without mic */}
            <button
              onClick={handleSkip}
              className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs transition-colors cursor-pointer mt-2"
            >
              <span>Continuer sans micro</span>
              <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
