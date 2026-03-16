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

/**
 * Full agent state — populated progressively by MCP tools.
 * Each field is optional because updates arrive incrementally.
 */
export interface AgentState {
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
    /** Which UI components the agent wants to display */
    visible_components?: string[];
}

export const COMPONENT_IDS = [
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
] as const;

export type ComponentId = typeof COMPONENT_IDS[number];
