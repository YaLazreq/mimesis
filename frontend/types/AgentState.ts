export interface BrandCreativeAngle {
    poetry?: string;
    painting?: string;
    music?: string;
    metaphor?: string;
    cinema?: string;
}

export interface BrandNewsItem {
    title: string;
    summary: string;
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
    brand_symbols?: string[];
    brand_mission?: string;
    brand_common_enemy?: string[];
    brand_strategy?: string;
    brand_last_news?: BrandNewsItem[];
    brand_viral_campaign?: string[];
    brand_creative_angle?: BrandCreativeAngle;
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
] as const;

export type ComponentId = typeof COMPONENT_IDS[number];
