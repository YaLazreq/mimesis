"""Step 1 — Brand Research Models."""

from pydantic import BaseModel, Field


class BrandIdentityInfo(BaseModel):
    brand_name: str = Field(description="The formal brand name")
    primary_color: list[str] = Field(
        description="Array of primary hex colors. MUST BE PURE HEX STRINGS ONLY (e.g. '#FF0000'). No text."
    )
    secondary_color: list[str] = Field(
        description="Array of secondary hex colors. MUST BE PURE HEX STRINGS ONLY. No text."
    )
    font_family: list[str] = Field(description="Name of the brand's primary font family")
    logo_description: str = Field(description="Description of the brand's logo aesthetic")


class BrandPhilosophyInfo(BaseModel):
    brand_slogan: str = Field(description="The exact iconic catchphrase or tagline")
    brand_mission: str = Field(
        description="1 sentence. The core reason the brand exists beyond profit"
    )
    brand_common_enemy: list[str] = Field(
        description="Array of strings. What does this brand fight against?"
    )
    style_keywords: list[str] = Field(description="Array of key stylistic words")


class BrandNewsItem(BaseModel):
    title: str = Field(description="4-5 word compressed title")
    summary: str = Field(description="2-3 sentence recap")


class BrandNewsInfo(BaseModel):
    brand_last_news: list[BrandNewsItem] = Field(description="Array of news items")
    brand_viral_campaign: list[str] = Field(
        description="Array of strings with most iconic or recent viral ads"
    )


class BrandCreativeAngle(BaseModel):
    poetry: str = Field(description="Poetry reference")
    painting: str = Field(description="Painting reference")
    music: str = Field(description="Music reference")
    metaphor: str = Field(description="Metaphor reference")
    cinema: str = Field(description="Cinema reference")


class BrandCultureInfo(BaseModel):
    brand_strategy: str = Field(description="Latest strategic direction in 1 sentence")
    brand_symbols: list[str] = Field(
        description="Array of strings. The brand's main visual symbols, icons, or representations"
    )
    brand_creative_angle: BrandCreativeAngle = Field(description="Creative angles")
