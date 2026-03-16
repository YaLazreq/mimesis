export interface TitleSummaryItem {
    title: string;
    summary: string;
}

export interface CreativeDirection {
    title: string;
    description: string;
}

export interface ImageAnalysis {
    product_description: string;
    visual_mood: string;
    image_colors: string[];
    creative_directions: CreativeDirection[];
    brand_alignment: string;
}

export interface UploadedImage {
    gcs_uri: string;
    analysis: ImageAnalysis;
    user_context: string;
}

export interface MasterSequenceScene {
    scene_number: number;
    beat_name: string;
    emotion: string;
    action_summary: string;
    duration_estimate: string;
}

export interface EnrichedScene extends MasterSequenceScene {
    visual_description?: string;
    camera_direction?: string;
    lighting_mood?: string;
    setting_description?: string;
    product_placement?: string;
}

export interface VisualStyleGuide {
    color_palette?: string[];
    lighting_style?: string;
    camera_style?: string;
    grain_texture?: string;
    art_direction?: string;
    format_ratio?: string;
    visual_keywords?: string[];
}

export type SessionPhase = 'brand_research' | 'brief' | 'sequence' | 'validated' | 'production' | 'production_complete' | 'video_generation' | 'video_complete';

/**
 * Full agent state — populated progressively by MCP tools.
 * Each field is optional because updates arrive incrementally.
 */
export interface AgentState {
    // ── Step 1: Brand Research ──
    brand_name?: string;
    primary_color?: string[];
    secondary_color?: string[];
    font_family?: string[];
    style_keywords?: string[];
    logo_description?: string;
    brand_slogan?: string;
    brand_symbols?: TitleSummaryItem[];
    brand_mission?: string[];
    brand_common_enemy?: string[];
    brand_strategy?: TitleSummaryItem[];
    brand_last_news?: TitleSummaryItem[];
    brand_viral_campaign?: string[];
    brand_creative_angle?: TitleSummaryItem[];
    /** Uploaded product images with analysis */
    uploaded_images?: UploadedImage[];

    // ── Step 2: Discovery Brief ──
    /** Current session phase — drives frontend layout */
    current_phase?: SessionPhase;
    /** Objective */
    ad_objective?: string;
    ad_objective_summary?: string;
    /** Audience */
    audience_age_range?: string;
    audience_gender?: string;
    audience_mindset?: string;
    audience_relationship_to_brand?: string;
    audience_persona_name?: string;
    audience_persona_summary?: string;
    /** Product */
    product_name?: string;
    product_category?: string;
    product_key_feature?: string;
    product_visual_anchor?: string;
    product_image_ref?: string;
    /** Emotion & Tone */
    ad_emotion_primary?: string;
    ad_emotion_secondary?: string;
    ad_tone?: string;
    ad_tone_references?: string[];
    /** Format & Constraints */
    ad_duration?: string;
    ad_platform?: string[];
    ad_mandatories?: string[];
    ad_music_direction?: string;
    /** Master Sequence */
    master_sequence?: MasterSequenceScene[];
    master_sequence_validated?: boolean;
    master_sequence_revision_notes?: string[];

    // ── Step 3: Production Workshop ──
    /** Visual style guide from Worker Director */
    visual_style_guide?: VisualStyleGuide;
    /** Enriched scenes from Worker Director */
    enriched_scenes?: EnrichedScene[];
    /** GCS URI of the anchor image */
    anchor_image_uri?: string;
    /** Whether the anchor has been validated */
    anchor_validated?: boolean;
    /** Scene keyframes — GCS URIs */
    scene_1_keyframe_start?: string;
    scene_1_keyframe_end?: string;
    scene_2_keyframe_start?: string;
    scene_2_keyframe_end?: string;
    scene_3_keyframe_start?: string;
    scene_3_keyframe_end?: string;
    scene_4_keyframe_start?: string;
    scene_4_keyframe_end?: string;
    scene_5_keyframe_start?: string;
    scene_5_keyframe_end?: string;
    scene_6_keyframe_start?: string;
    scene_6_keyframe_end?: string;
    /** Whether all scenes are locked */
    all_scenes_validated?: boolean;

    // ── Step 4: Final Video Generation ──
    is_generating_video?: boolean;
    video_generation_progress?: string;
    final_video_uri?: string;

    /** Which UI components the agent wants to display */
    visible_components?: string[];
}

export const COMPONENT_IDS = [
    // Step 1
    'brand_name',
    'brand_slogan',
    'brand_symbols',
    'brand_mission',
    'brand_common_enemy',
    'brand_strategy',
    'brand_last_news',
    'brand_viral_campaign',
    'brand_creative_angle',
    'primary_color',
    'secondary_color',
    'style_keywords',
    'uploaded_images',
    // Step 2
    'ad_objective',
    'ad_audience',
    'ad_product',
    'ad_emotion',
    'ad_format',
    'master_sequence',
    // Step 3
    'anchor_image',
    'scene_1',
    'scene_2',
    'scene_3',
    'scene_4',
    'scene_5',
    'scene_6',
    'production_workshop',
    // Step 4
    'final_video'
] as const;

export type ComponentId = typeof COMPONENT_IDS[number];
