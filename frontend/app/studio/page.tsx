"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { typography } from "../designSystem";
import VoiceSession from "@/components/voice/VoiceSession";
import AnimatedBackground from "@/components/background/AnimatedBackground";
import InfoBadge from "@/components/ui/InfoBadge";
import ZeroGravitySpace from "@/components/ui/ZeroGravitySpace";
import CentralEntity from "@/components/ui/CentralEntity";
import FloatingGroup from "@/components/ui/FloatingGroup";
import FloatingItem from "@/components/ui/FloatingItem";
import ImageUpload from "@/components/ui/ImageUpload";
import BriefSection from "@/components/ui/BriefSection";
import MasterSequenceTimeline from "@/components/ui/MasterSequenceTimeline";
import { AnchorWorkshop, SceneCard } from "@/components/ui/ProductionWorkshop";
import { useAgentState } from "@/contexts/AgentStateContext";
import { ExternalLink, X, Braces } from "lucide-react";

export default function StudioPage() {
  const router = useRouter();
  const {
    state,
    isComponentVisible,
    sessionId: agentSessionId,
  } = useAgentState();
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  const [agentStatus, setAgentStatus] = useState<
    "listening" | "speaking" | "thinking"
  >("listening");
  const [focusedElementId, setFocusedElementId] = useState<string | null>(null);

  // Phase detection
  const currentPhase = state.current_phase || "brand_research";
  const isStep2 =
    currentPhase === "brief" ||
    currentPhase === "sequence" ||
    currentPhase === "validated";
  const isStep3 =
    currentPhase === "production" || currentPhase === "production_complete";
  const isStep4 = 
    currentPhase === "video_generation" || currentPhase === "video_complete";
  const activeStep = currentPhase === "brand_research" ? 1 : isStep4 ? 4 : isStep3 ? 3 : 2;

  // Derived state for focus
  const focusedNewsIndex = focusedElementId?.startsWith("news-")
    ? parseInt(focusedElementId.split("-")[1])
    : null;
  const focusedNewsItem =
    focusedNewsIndex !== null
      ? state.brand_last_news?.[focusedNewsIndex]
      : null;
  const hasSummaryToDisplay = focusedNewsItem && focusedNewsItem.summary;

  // ── Voice → Focus IA Bridge ──────────────────────────────────────────────
  // Maps component IDs (from agent's set_ui_layout) to FloatingGroup IDs
  const COMPONENT_TO_GROUP: Record<string, string> = {
    // Step 1
    style_keywords: "group-keywords",
    brand_symbols: "group-symbols",
    brand_strategy: "group-strategy",
    brand_mission: "group-mission",
    brand_common_enemy: "group-enemy",
    brand_last_news: "group-news",
    brand_viral_campaign: "group-campaigns",
    uploaded_images: "group-images",
    // Step 2
    ad_objective: "group-objective",
    ad_audience: "group-audience",
    ad_product: "group-product",
    ad_emotion: "group-emotion",
    ad_format: "group-format",
    master_sequence: "group-sequence",
    // Step 3
    // Step 3
    anchor_image: "group-anchor",
    scene_1: "group-scene-1",
    scene_2: "group-scene-2",
    scene_3: "group-scene-3",
    scene_4: "group-scene-4",
    scene_5: "group-scene-5",
    scene_6: "group-scene-6",
    production_workshop: "group-anchor",
    // Step 4
    final_video: "group-final-video",
  };

  const prevVisibleRef = useRef<string[] | undefined>(undefined);
  useEffect(() => {
    const vc = state.visible_components;
    const prev = prevVisibleRef.current;
    prevVisibleRef.current = vc;

    // Skip the very first render (no previous value yet)
    if (prev === undefined) return;

    // If no layout set, or "all" → restore default view
    if (!vc || vc.length === 0 || vc.includes("all")) {
      window.dispatchEvent(
        new CustomEvent("mimesis-focus", {
          detail: { elementId: null, groupId: null },
        }),
      );
      return;
    }

    // Only trigger focus if the agent explicitly isolated ONE component.
    // Background workers append multiple components progressively, which should NOT trigger focus.
    if (vc.length === 1) {
      const focusComponent = vc[0];
      if (COMPONENT_TO_GROUP[focusComponent]) {
        const groupId = COMPONENT_TO_GROUP[focusComponent];
        // Dispatch a focus event targeting the group (no specific item)
        window.dispatchEvent(
          new CustomEvent("mimesis-focus", {
            detail: { elementId: `${groupId}-voice`, groupId },
          }),
        );
        return;
      }
    }

    // If multiple components are visible (e.g. progressively loaded by workers),
    // ensure no specific group is focused, maintaining the default layout.
    window.dispatchEvent(
      new CustomEvent("mimesis-focus", {
        detail: { elementId: null, groupId: null },
      }),
    );
  }, [state.visible_components]);

  // ── Phase Change → Unfocus (triggers dormancy re-evaluation) ──────────
  const prevPhaseRef = useRef(currentPhase);
  useEffect(() => {
    if (prevPhaseRef.current !== currentPhase) {
      prevPhaseRef.current = currentPhase;
      // Phase changed — trigger restore to update group dormancy
      window.dispatchEvent(
        new CustomEvent("mimesis-focus", {
          detail: { elementId: null, groupId: null },
        }),
      );
    }
  }, [currentPhase]);

  return (
    <>
      {/* Apple Music-style animated background — always renders as base layer */}
      <AnimatedBackground />

      {/* Content layer — sits above the background */}
      <div
        className="relative flex flex-col min-h-screen"
        style={{ zIndex: 1 }}
      >
        {/* Header */}
        <header className="absolute top-0 left-0 w-full flex items-center justify-between p-6 z-50 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <h1
              onClick={() => (window.location.href = "/")}
              style={{
                ...typography.h2,
                fontSize: "24px",
                letterSpacing: "-0.8px",
                lineHeight: "1",
                cursor: "pointer",
              }}
            >
              Mimesis
            </h1>
            <InfoBadge text="Creative Storyteller" />
          </div>

          {/* Agent Status Bubble */}
          <div
            className={`pointer-events-auto transition-all duration-500 ease-in-out px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md flex items-center gap-2 ${agentStatus === "speaking"
              ? "bg-blue-500/20 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              : agentStatus === "thinking"
                ? "bg-purple-500/20 text-purple-200"
                : "bg-white/5 text-white/50"
              }`}
          >
            {agentStatus === "speaking" && (
              <div className="flex gap-1 items-center h-3">
                <span
                  className="w-1 h-3 bg-blue-400 rounded-full animate-pulse"
                  style={{ animationDelay: "0ms" }}
                ></span>
                <span
                  className="w-1 h-2 bg-blue-400 rounded-full animate-pulse"
                  style={{ animationDelay: "150ms" }}
                ></span>
                <span
                  className="w-1 h-3 bg-blue-400 rounded-full animate-pulse"
                  style={{ animationDelay: "300ms" }}
                ></span>
              </div>
            )}
            {agentStatus === "thinking" && (
              <div className="flex gap-1 items-center h-3">
                <span
                  className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></span>
                <span
                  className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></span>
                <span
                  className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></span>
              </div>
            )}
            <span className="text-xs font-medium tracking-wider uppercase">
              {agentStatus === "speaking"
                ? "Mimesis is speaking..."
                : agentStatus === "thinking"
                  ? "Mimesis is thinking..."
                  : "Mimesis is listening..."}
            </span>
          </div>
        </header>

        {/* Main Row Wrapper (Left: UI / Right: Data Explorer) */}
        <div className="flex-1 flex flex-row overflow-hidden relative z-10 w-full">
          {/* Main content area — components render based on agent's visible_components */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-8 overflow-y-auto pb-40">
            {/* ── Zero Gravity Space ────────────────────────────────────────── */}
            <ZeroGravitySpace
              onFocusChange={(id) => setFocusedElementId(id)}
              activeStep={activeStep}
            >
              {/* 1. The Central Entity (Brand Name & Slogan) — always visible */}
              {state.brand_name && (
                <CentralEntity
                  name={state.brand_name}
                  slogan={state.brand_slogan}
                />
              )}

              {/* ═══════════════ STEP 1 FloatingGroups ═══════════════ */}

              {/* 2. Style Keywords Orbiting */}
              {state.style_keywords && state.style_keywords.length > 0 && (
                <FloatingGroup
                  id="group-keywords"
                  title="Keywords"
                  cx={15}
                  cy={35}
                  radius={140}
                  step={1}
                  items={state.style_keywords.map((kw, i) => (
                    <FloatingItem
                      key={`kw-${i}`}
                      id={`kw-${i}`}
                      delay={i * 0.2}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-google-sans)",
                          fontStyle: "italic",
                          color: "#fff",
                          fontSize: "1.2rem",
                          fontWeight: 500,
                          textShadow: "0 2px 10px rgba(71, 71, 71, 0.8)",
                        }}
                      >
                        {kw}
                      </div>
                    </FloatingItem>
                  ))}
                />
              )}

              {/* 3. Brand Symbols */}
              {state.brand_symbols && state.brand_symbols.length > 0 && (
                <FloatingGroup
                  id="group-symbols"
                  title="Symbols"
                  cx={35}
                  cy={18}
                  radius={160}
                  step={1}
                  items={state.brand_symbols.map((sym: any, i: number) => (
                    <FloatingItem
                      key={`sym-${i}`}
                      id={`sym-${i}`}
                      delay={i * 0.3}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full border border-white/20 bg-white/5 backdrop-blur-md shadow-xl flex items-center justify-center overflow-hidden">
                          {/* Image will go here */}
                        </div>
                        <span className="text-white/90 text-[11px] font-medium tracking-wide text-center max-w-[100px] leading-tight drop-shadow-md">
                          {sym?.title || sym}
                        </span>
                      </div>
                    </FloatingItem>
                  ))}
                />
              )}

              {/* 4. Strategy */}
              {state.brand_strategy && state.brand_strategy.length > 0 && (
                <FloatingGroup
                  id="group-strategy"
                  title="Strategy"
                  cx={65}
                  cy={22}
                  radius={180}
                  step={1}
                  items={state.brand_strategy.map((strat: any, i: number) => (
                    <FloatingItem
                      key={`strategy-${i}`}
                      id={`strategy-${i}`}
                      delay={i * 0.2}
                    >
                      <div className="flex flex-col items-center gap-0.5 bg-black/40 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl w-[160px] hover:bg-black/60 transition-colors">
                        <span className="text-white/90 text-sm font-medium text-left leading-snug">
                          {strat?.title || strat}
                        </span>
                        <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold cursor-pointer hover:text-white/80 transition-colors mt-1">
                          Click for deep dive
                        </span>
                      </div>
                    </FloatingItem>
                  ))}
                />
              )}

              {/* 5. Mission */}
              {state.brand_mission && state.brand_mission.length > 0 && (
                <FloatingGroup
                  id="group-mission"
                  title="Mission"
                  cx={20}
                  cy={75}
                  radius={150}
                  step={1}
                  items={state.brand_mission.map(
                    (mission: string, i: number) => (
                      <FloatingItem
                        key={`mission-${i}`}
                        id={`mission-${i}`}
                        delay={i * 0.3}
                      >
                        <div
                          style={{
                            fontFamily: "var(--font-google-sans)",
                            fontStyle: "italic",
                            color: "#fff",
                            fontSize: "1.2rem",
                            fontWeight: 500,
                            textShadow: "0 2px 10px rgba(71, 71, 71, 0.8)",
                          }}
                          className="w-[150px] text-center leading-tight"
                        >
                          {mission}
                        </div>
                      </FloatingItem>
                    ),
                  )}
                />
              )}

              {/* 6. Common Enemy */}
              {state.brand_common_enemy &&
                state.brand_common_enemy.length > 0 && (
                  <FloatingGroup
                    id="group-enemy"
                    title="Common Enemy"
                    cx={45}
                    cy={80}
                    radius={150}
                    step={1}
                    items={state.brand_common_enemy.map(
                      (enemy: string, i: number) => (
                        <FloatingItem
                          key={`enemy-${i}`}
                          id={`enemy-${i}`}
                          delay={i * 0.4}
                        >
                          <div
                            style={{
                              fontFamily: "var(--font-google-sans)",
                              fontStyle: "italic",
                              color: "#fff",
                              fontSize: "1.2rem",
                              fontWeight: 500,
                              textShadow: "0 2px 10px rgba(71, 71, 71, 0.8)",
                            }}
                            className="w-[150px] text-center leading-tight"
                          >
                            {enemy}
                          </div>
                        </FloatingItem>
                      ),
                    )}
                  />
                )}

              {/* 7. Last News */}
              {state.brand_last_news && state.brand_last_news.length > 0 && (
                <FloatingGroup
                  id="group-news"
                  title="News"
                  cx={82}
                  cy={75}
                  radius={180}
                  step={1}
                  items={state.brand_last_news.map((news: any, i: number) => (
                    <FloatingItem
                      key={`news-${i}`}
                      id={`news-${i}`}
                      delay={i * 0.25}
                    >
                      <div className="flex flex-col justify-between bg-black p-4 rounded-xl w-[240px] h-[100px] text-left">
                        <div className="flex items-start justify-between gap-2 overflow-hidden w-full">
                          <span
                            className="text-white text-lg font-medium tracking-tight leading-snug line-clamp-3"
                            style={{ fontFamily: "var(--font-google-sans)" }}
                          >
                            {news?.title || news}
                          </span>
                          <ExternalLink className="w-4 h-4 text-white shrink-0 mt-1" />
                        </div>
                        {news?.summary && (
                          <span
                            className="text-[#898989] text-sm leading-snug truncate whitespace-nowrap block w-full text-left"
                            style={{ fontFamily: "var(--font-google-sans)" }}
                          >
                            {news.summary}
                          </span>
                        )}
                      </div>
                    </FloatingItem>
                  ))}
                />
              )}

              {/* 8. Viral Campaigns */}
              {state.brand_viral_campaign &&
                state.brand_viral_campaign.length > 0 && (
                  <FloatingGroup
                    id="group-campaigns"
                    title=""
                    cx={82}
                    cy={44}
                    radius={0}
                    step={1}
                    items={[
                      <FloatingItem key="campaigns-list" id="campaigns-list">
                        <div className="flex gap-4 items-stretch">
                          {/* Left-Aligned Elements Container */}
                          <div className="flex flex-col items-start gap-1 py-1">
                            {/* Custom Title aligned with items */}
                            <h3
                              style={{
                                fontFamily: "var(--font-google-sans)",
                                color: "#fff",
                                fontSize: "2.5rem",
                                fontWeight: 600,
                                letterSpacing: "-1.5px",
                              }}
                              className="leading-none text-left mb-2"
                            >
                              Campaigns
                            </h3>

                            {/* Items List */}
                            <div className="flex flex-col gap-2 items-start mt-1">
                              {state.brand_viral_campaign.map(
                                (camp: string, i: number) => (
                                  <div
                                    key={i}
                                    className="group cursor-pointer text-left opacity-90 hover:opacity-100 transition-opacity whitespace-nowrap"
                                  >
                                    <span
                                      style={{
                                        fontFamily: "var(--font-google-sans)",
                                      }}
                                      className="text-white text-[1.4rem] italic tracking-tight leading-tight"
                                    >
                                      {camp}
                                    </span>
                                    <ExternalLink className="inline-block w-[18px] h-[18px] text-white stroke-[2.5px] ml-3 mb-1 shrink-0" />
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </FloatingItem>,
                    ]}
                  />
                )}

              {/* ═══════════════ STEP 2 FloatingGroups ═══════════════ */}

              {/* S2-1. Objective */}
              {state.ad_objective && (
                <FloatingGroup
                  id="group-objective"
                  title="Objective"
                  cx={35}
                  cy={22}
                  radius={160}
                  step={2}
                  items={[
                    <FloatingItem key="objective-card" id="objective-card">
                      <BriefSection
                        title="Objective"
                        icon="🎯"
                        isVisible={true}
                        fields={[
                          { label: "Objective", value: state.ad_objective },
                          {
                            label: "Summary",
                            value: state.ad_objective_summary,
                          },
                        ]}
                      />
                    </FloatingItem>,
                  ]}
                />
              )}

              {/* S2-2. Audience */}
              {(state.audience_persona_name || state.audience_age_range) && (
                <FloatingGroup
                  id="group-audience"
                  title="Audience"
                  cx={15}
                  cy={50}
                  radius={160}
                  step={2}
                  items={[
                    <FloatingItem key="audience-card" id="audience-card">
                      <BriefSection
                        title="Audience"
                        icon="👥"
                        isVisible={true}
                        fields={[
                          {
                            label: "Persona",
                            value: state.audience_persona_name,
                          },
                          {
                            label: "Age Range",
                            value: state.audience_age_range,
                          },
                          { label: "Gender", value: state.audience_gender },
                          { label: "Mindset", value: state.audience_mindset },
                          {
                            label: "Relationship",
                            value: state.audience_relationship_to_brand,
                          },
                          {
                            label: "Summary",
                            value: state.audience_persona_summary,
                          },
                        ]}
                      />
                    </FloatingItem>,
                  ]}
                />
              )}

              {/* S2-3. Product */}
              {state.product_name && (
                <FloatingGroup
                  id="group-product"
                  title="Product"
                  cx={80}
                  cy={25}
                  radius={160}
                  step={2}
                  items={[
                    <FloatingItem key="product-card" id="product-card">
                      <BriefSection
                        title="Product Focus"
                        icon="📦"
                        isVisible={true}
                        fields={[
                          { label: "Product", value: state.product_name },
                          { label: "Category", value: state.product_category },
                          {
                            label: "Key Feature",
                            value: state.product_key_feature,
                          },
                          {
                            label: "Visual Anchor",
                            value: state.product_visual_anchor,
                          },
                        ]}
                      />
                    </FloatingItem>,
                  ]}
                />
              )}

              {/* S2-4. Emotion & Tone */}
              {state.ad_emotion_primary && (
                <FloatingGroup
                  id="group-emotion"
                  title="Emotion & Tone"
                  cx={85}
                  cy={55}
                  radius={160}
                  step={2}
                  items={[
                    <FloatingItem key="emotion-card" id="emotion-card">
                      <BriefSection
                        title="Emotion & Tone"
                        icon="💫"
                        isVisible={true}
                        fields={[
                          {
                            label: "Primary Emotion",
                            value: state.ad_emotion_primary,
                          },
                          {
                            label: "Secondary Emotion",
                            value: state.ad_emotion_secondary,
                          },
                          { label: "Tone", value: state.ad_tone },
                          {
                            label: "References",
                            value: state.ad_tone_references,
                          },
                        ]}
                      />
                    </FloatingItem>,
                  ]}
                />
              )}

              {/* S2-5. Format & Constraints */}
              {(state.ad_duration || state.ad_platform) && (
                <FloatingGroup
                  id="group-format"
                  title="Format"
                  cx={50}
                  cy={78}
                  radius={160}
                  step={2}
                  items={[
                    <FloatingItem key="format-card" id="format-card">
                      <BriefSection
                        title="Format & Constraints"
                        icon="🎬"
                        isVisible={true}
                        fields={[
                          { label: "Duration", value: state.ad_duration },
                          { label: "Platforms", value: state.ad_platform },
                          { label: "Mandatories", value: state.ad_mandatories },
                          {
                            label: "Music Direction",
                            value: state.ad_music_direction,
                          },
                        ]}
                      />
                    </FloatingItem>,
                  ]}
                />
              )}

              {/* S2-6. Master Sequence Timeline */}
              {state.master_sequence && state.master_sequence.length > 0 && (
                <FloatingGroup
                  id="group-sequence"
                  title="Master Sequence"
                  cx={50}
                  cy={50}
                  radius={0}
                  step={2}
                  collapseInOrbit
                  items={[
                    <FloatingItem
                      key="sequence-timeline"
                      id="sequence-timeline"
                    >
                      <MasterSequenceTimeline
                        scenes={state.master_sequence}
                        validated={state.master_sequence_validated}
                      />
                    </FloatingItem>,
                  ]}
                />
              )}

              {/* ═══════════════ STEP 3 FloatingGroups ═══════════════ */}

              {/* Anchor Sub-Group */}
              {(state.anchor_image_uri || state.visual_style_guide) && (
                <FloatingGroup
                  id="group-anchor"
                  title="Visual DNA"
                  cx={10}
                  cy={50}
                  radius={0}
                  step={3}
                  items={[
                    <FloatingItem key="anchor-workshop" id="anchor-workshop">
                      <AnchorWorkshop state={state} />
                    </FloatingItem>,
                  ]}
                />
              )}

              {/* Scene Keyframes Grid broken into individual blocks */}
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const startKey =
                  `scene_${num}_keyframe_start` as keyof typeof state;
                const endKey =
                  `scene_${num}_keyframe_end` as keyof typeof state;
                const startUri = state[startKey] as string | undefined;
                const endUri = state[endKey] as string | undefined;
                const scene = state.enriched_scenes?.find(
                  (s) => s.scene_number === num,
                );

                if (!startUri && !endUri) return null;

                // Generate distinct positions for each scene, spaced around the central entity
                const coords = [
                  { cx: 38, cy: 18 }, // scene 1
                  { cx: 62, cy: 25 }, // scene 2
                  { cx: 85, cy: 35 }, // scene 3
                  { cx: 84, cy: 68 }, // scene 4
                  { cx: 60, cy: 75 }, // scene 5
                  { cx: 36, cy: 75 }, // scene 6
                ];
                const { cx, cy } = coords[num - 1];

                return (
                  <FloatingGroup
                    key={`group-scene-${num}`}
                    id={`group-scene-${num}`}
                    title={`Scene ${num}`}
                    cx={cx}
                    cy={cy}
                    radius={0}
                    step={3}
                    items={[
                      <FloatingItem
                        key={`scene-card-${num}`}
                        id={`scene-card-${num}`}
                      >
                        <SceneCard
                          sceneNumber={num}
                          scene={scene}
                          startUri={startUri}
                          endUri={endUri}
                          isLocked={
                            state[
                            `scene_${num}_locked` as keyof typeof state
                            ] as boolean
                          }
                        />
                      </FloatingItem>,
                    ]}
                  />
                );
              })}

              {/* ═══════════════ STEP 4 FloatingGroups ═══════════════ */}

              {state.final_video_uri && (
                <FloatingGroup
                  id="group-final-video"
                  title="Final Commercial"
                  cx={50}
                  cy={50}
                  radius={0}
                  step={4}
                  items={[
                    <FloatingItem key="final-video-player" id="final-video-player">
                      <div className="w-[800px] md:w-[1000px] rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.15)] bg-black/80 backdrop-blur-xl mb-12">
                        <video 
                           src={state.final_video_uri}
                           controls
                           autoPlay
                           className="w-full h-auto object-cover"
                           style={{ maxHeight: '650px' }}
                        />
                      </div>
                    </FloatingItem>
                  ]}
                />
              )}
            </ZeroGravitySpace>

            {/* ── Image Upload Zone — only shown when agent focuses on it ── */}
            {isComponentVisible("uploaded_images") && state.brand_name && (
              <div
                className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
                style={{ animation: "fadeIn 0.6s ease-out forwards" }}
              >
                <div className="pointer-events-auto">
                  <ImageUpload
                    sessionId={agentSessionId || "default"}
                    onUploadComplete={(uri) =>
                      console.log("Image uploaded:", uri)
                    }
                    onAnalyzing={() => setAgentStatus("thinking")}
                  />
                </div>
              </div>
            )}

            {/* ── Video Generation Loading Overlay ── */}
            {state.is_generating_video && (
              <div
                className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl pointer-events-auto"
                style={{ animation: "fadeIn 0.6s ease-out forwards" }}
              >
                <div className="flex flex-col items-center gap-8 max-w-xl text-center">
                  {/* Cinematic Spinner */}
                  <div className="relative w-24 h-24">
                     <div className="absolute inset-0 border-t-2 border-white/80 rounded-full animate-spin"></div>
                     <div className="absolute inset-2 border-r-2 border-white/40 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <h2 className="text-4xl text-white font-medium tracking-tight" style={{ fontFamily: "var(--font-google-sans)" }}>
                       Producing Final Commercial
                    </h2>
                    <p className="text-white/60 text-xl font-light">
                       {state.video_generation_progress || "Initializing video pipeline..."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Left Panel */}
            <div
              className={`absolute left-10 top-1/2 -translate-y-1/2 w-[340px] bg-black/60 backdrop-blur-3xl border border-white/10 p-6 rounded-2xl shadow-2xl text-left transition-all duration-700 pointer-events-none z-50 ${hasSummaryToDisplay ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
            >
              {hasSummaryToDisplay && (
                <>
                  <h3
                    style={{ fontFamily: "var(--font-google-sans)" }}
                    className="text-white text-xl font-medium tracking-tight mb-4 leading-snug"
                  >
                    {focusedNewsItem.title || "News"}
                  </h3>
                  <p
                    style={{ fontFamily: "var(--font-google-sans)" }}
                    className="text-#898989 text-[1rem] leading-relaxed text-[#898989]"
                  >
                    {focusedNewsItem.summary}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Right JSON Raw Panel */}
          {isJsonOpen ? (
            <div className="w-[450px] shrink-0 bg-black backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto pb-40 flex flex-col gap-4 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
              <div className="sticky top-0 bg-black pb-4 z-10 border-b border-white/10 mb-2 flex items-center justify-between">
                <h2 className="text-white/50 uppercase tracking-widest text-xs font-semibold">
                  Raw JSON State
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(state, null, 2),
                      );
                    }}
                    className="text-white/30 hover:text-white/70 transition-colors cursor-pointer text-[10px] uppercase tracking-wider border border-white/10 rounded px-2 py-1"
                    title="Copy JSON"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setIsJsonOpen(false)}
                    className="text-white/40 hover:text-white transition-colors cursor-pointer"
                    title="Close JSON View"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <pre
                className="text-[12px] font-mono leading-relaxed text-green-300/90 bg-white/[0.03] rounded-lg p-4 border border-white/5 overflow-x-auto whitespace-pre-wrap break-words"
                style={{ tabSize: 2 }}
              >
                {JSON.stringify(state, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* Toggle button — Raw JSON only */}
          {!isJsonOpen && (
            <div className="absolute top-6 right-6 z-50">
              <button
                onClick={() => setIsJsonOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-black/50 border border-white/10 text-white/50 hover:text-white hover:bg-black/80 transition-all backdrop-blur-md cursor-pointer shadow-[0_4px_15px_rgba(0,0,0,0.3)]"
                title="Open Raw JSON View"
              >
                <Braces size={18} />
              </button>
            </div>
          )}

          {/* ── Memory Status Bar ── persistent bottom-left indicator */}
          <div className="fixed bottom-[110px] left-6 z-40 flex flex-col gap-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-[0_4px_20px_rgba(0,0,0,0.4)] max-w-[200px]">
            <span className="text-white/30 text-[9px] uppercase tracking-widest font-semibold mb-0.5">
              Memory
            </span>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {[
                "brand_name",
                "brand_slogan",
                "primary_color",
                "secondary_color",
                "brand_mission",
                "brand_common_enemy",
                "brand_strategy",
                "brand_symbols",
                "brand_creative_angle",
                "brand_last_news",
                "brand_viral_campaign",
                "style_keywords",
                "font_family",
                "logo_description",
                "uploaded_images",
              ].map((key) => {
                const hasData =
                  state[key as keyof typeof state] !== undefined &&
                  state[key as keyof typeof state] !== null &&
                  state[key as keyof typeof state] !== "" &&
                  !(
                    Array.isArray(state[key as keyof typeof state]) &&
                    (state[key as keyof typeof state] as unknown[]).length === 0
                  );
                return (
                  <div
                    key={key}
                    className="flex items-center gap-1 cursor-default"
                    title={hasData ? `${key}: loaded` : `${key}: empty`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${hasData ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" : "bg-white/15"}`}
                    />
                    <span
                      className={`text-[9px] font-mono transition-colors duration-500 ${hasData ? "text-white/60" : "text-white/20"}`}
                    >
                      {key.replace("brand_", "").replace("_", " ")}
                    </span>
                  </div>
                );
              })}
              {/* Step 2 Brief indicators */}
              {isStep2 && (
                <>
                  <div className="w-full h-px bg-white/10 my-1" />
                  {[
                    { key: "ad_objective", label: "objective" },
                    { key: "audience_persona_name", label: "audience" },
                    { key: "product_name", label: "product" },
                    { key: "ad_emotion_primary", label: "emotion" },
                    { key: "ad_duration", label: "format" },
                    { key: "master_sequence", label: "sequence" },
                  ].map(({ key, label }) => {
                    const val = state[key as keyof typeof state];
                    const hasData =
                      val !== undefined &&
                      val !== null &&
                      val !== "" &&
                      !(Array.isArray(val) && val.length === 0);
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-1 cursor-default"
                        title={hasData ? `${label}: loaded` : `${label}: empty`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${hasData ? "bg-blue-400 shadow-[0_0_4px_rgba(96,165,250,0.6)]" : "bg-white/15"}`}
                        />
                        <span
                          className={`text-[9px] font-mono transition-colors duration-500 ${hasData ? "text-blue-300/60" : "text-white/20"}`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
              {/* Step 3 Production indicators */}
              {isStep3 && (
                <>
                  <div className="w-full h-px bg-white/10 my-1" />
                  {[
                    { key: "visual_style_guide", label: "style guide" },
                    { key: "anchor_image_uri", label: "anchor" },
                    { key: "scene_1_keyframe_start", label: "scene 1" },
                    { key: "scene_2_keyframe_start", label: "scene 2" },
                    { key: "scene_3_keyframe_start", label: "scene 3" },
                    { key: "scene_4_keyframe_start", label: "scene 4" },
                    { key: "scene_5_keyframe_start", label: "scene 5" },
                    { key: "scene_6_keyframe_start", label: "scene 6" },
                  ].map(({ key, label }) => {
                    const val = state[key as keyof typeof state];
                    const hasData =
                      val !== undefined && val !== null && val !== "";
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-1 cursor-default"
                        title={hasData ? `${label}: loaded` : `${label}: empty`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${hasData ? "bg-purple-400 shadow-[0_0_4px_rgba(192,132,252,0.6)]" : "bg-white/15"}`}
                        />
                        <span
                          className={`text-[9px] font-mono transition-colors duration-500 ${hasData ? "text-purple-300/60" : "text-white/20"}`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
              {/* Step 4 Video indicators */}
              {isStep4 && (
                <>
                  <div className="w-full h-px bg-white/10 my-1" />
                  {[
                    { key: "final_video_uri", label: "master video" },
                  ].map(({ key, label }) => {
                    const val = state[key as keyof typeof state];
                    const hasData =
                      val !== undefined && val !== null && val !== "";
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-1 cursor-default"
                        title={hasData ? `${label}: loaded` : `${label}: empty`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${hasData ? "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.6)]" : "bg-white/15"}`}
                        />
                        <span
                          className={`text-[9px] font-mono transition-colors duration-500 ${hasData ? "text-amber-300/60" : "text-white/20"}`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Voice session bar — fixed at bottom */}
        <div className="fixed bottom-[40px] left-1/2 -translate-x-1/2 z-50">
          <VoiceSession
            onStop={() => router.push("/")}
            onStatusChange={setAgentStatus}
          />
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </>
  );
}
