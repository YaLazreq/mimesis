"use client";

import React from "react";
import { AgentState, EnrichedScene } from "@/types/AgentState";

/**
 * Convert a gs:// URI to a backend proxy URL.
 */
export function gcsToProxyUrl(gcsUri: string): string {
  if (!gcsUri || !gcsUri.startsWith("gs://")) return gcsUri;
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  return `${backendUrl}/api/gcs-proxy?uri=${encodeURIComponent(gcsUri)}`;
}

interface AnchorWorkshopProps {
  state: AgentState;
}

export function AnchorWorkshop({ state }: AnchorWorkshopProps) {
  const anchorUri = state.anchor_image_uri;
  const styleGuide = state.visual_style_guide;
  const isComplete = state.all_scenes_validated;

  if (!anchorUri && !styleGuide) return null;

  return (
    <div className="w-full max-w-[500px] flex flex-col gap-4">
      {/* Style Guide Summary */}
      {styleGuide && (
        <div className="flex flex-col gap-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎨</span>
            <h3
              className="text-white text-base font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-google-sans)" }}
            >
              Visual Direction
            </h3>
            {isComplete && (
              <span className="ml-auto text-[10px] uppercase tracking-widest text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full">
                ✓ Locked
              </span>
            )}
          </div>
          <p
            className="text-white/60 text-sm leading-relaxed"
            style={{ fontFamily: "var(--font-google-sans)" }}
          >
            {styleGuide.art_direction}
          </p>
          {/* Color palette dots */}
          {styleGuide.color_palette && styleGuide.color_palette.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              {styleGuide.color_palette.map((color, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full border border-white/20 shadow-md"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <span className="text-white/30 text-[10px] ml-2 uppercase tracking-wider">
                {styleGuide.lighting_style}
              </span>
            </div>
          )}
          {/* Visual keywords */}
          {styleGuide.visual_keywords &&
            styleGuide.visual_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {styleGuide.visual_keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-white/50 bg-white/5 border border-white/10 rounded-full px-2 py-0.5"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Anchor Image */}
      {anchorUri && (
        <div className="flex flex-col gap-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎬</span>
            <h3
              className="text-white text-base font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-google-sans)" }}
            >
              Anchor Image — Visual DNA
            </h3>
            {state.anchor_validated && (
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full ml-auto">
                ✓ Validated
              </span>
            )}
          </div>
          <div className="relative overflow-hidden rounded-xl border border-white/10 shadow-2xl mt-2">
            <img
              src={gcsToProxyUrl(anchorUri)}
              alt="Anchor image — visual direction"
              className="w-full h-auto object-cover"
              style={{ aspectRatio: "16/9" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export interface SceneCardProps {
  sceneNumber: number;
  scene?: EnrichedScene;
  startUri?: string;
  endUri?: string;
  isLocked?: boolean;
}

export function SceneCard({
  sceneNumber,
  scene,
  startUri,
  endUri,
  isLocked,
}: SceneCardProps) {
  if (!startUri && !endUri) return null;

  return (
    <div className="flex flex-col gap-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl w-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-white/30 bg-white/5 rounded px-1.5 py-0.5 tabular-nums">
            {String(sceneNumber).padStart(2, "0")}
          </span>
          <span
            className="text-white text-sm font-medium truncate"
            style={{ fontFamily: "var(--font-google-sans)" }}
          >
            {scene?.beat_name || `Scene ${sceneNumber}`}
          </span>
        </div>
        {isLocked && (
          <span className="text-[9px] text-emerald-400 uppercase tracking-widest font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full">
            ✓ Locked
          </span>
        )}
      </div>

      {/* Emotion badge */}
      {scene?.emotion && (
        <span className="text-[10px] text-white/40 italic truncate mt-1 block">
          {scene.emotion}
        </span>
      )}

      {/* Keyframes */}
      <div className="flex gap-2 mt-2">
        {startUri && (
          <div className="flex-1 relative overflow-hidden rounded-lg border border-white/10 shadow-lg">
            <img
              src={gcsToProxyUrl(startUri)}
              alt={`Scene ${sceneNumber} — start`}
              className="w-full h-auto object-cover"
              style={{ aspectRatio: "16/9" }}
            />
            <span className="absolute bottom-1 left-1.5 text-[8px] text-white/50 bg-black/60 px-1 rounded uppercase tracking-wider">
              Start
            </span>
          </div>
        )}
        {endUri && (
          <div className="flex-1 relative overflow-hidden rounded-lg border border-white/10 shadow-lg">
            <img
              src={gcsToProxyUrl(endUri)}
              alt={`Scene ${sceneNumber} — end`}
              className="w-full h-auto object-cover"
              style={{ aspectRatio: "16/9" }}
            />
            <span className="absolute bottom-1 left-1.5 text-[8px] text-white/50 bg-black/60 px-1 rounded uppercase tracking-wider">
              End
            </span>
          </div>
        )}
      </div>

      {/* Action summary */}
      {scene?.action_summary && (
        <p
          className="text-[11px] text-white/60 leading-snug line-clamp-3 mt-2"
          style={{ fontFamily: "var(--font-google-sans)" }}
        >
          {scene.action_summary}
        </p>
      )}
    </div>
  );
}

export default function ProductionWorkshop({ state }: { state: AgentState }) {
  return null; // Kept for default import backwards compat
}
