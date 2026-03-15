import asyncio
import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("../.env")

async def main():
    client = genai.Client()
    response = await client.aio.models.generate_content(
        model='gemini-2.5-flash',
        contents="""
        Find the visual identity details for brand: Rolex. 
        Strictly determine their primary colors, secondary colors, typography, and logo.
        Respond ONLY in a strict JSON format matching exactly this schema:
        {
            "brand_name": "string",
            "primary_color": ["string"],
            "secondary_color": ["string"],
            "font_family": ["string"],
            "logo_description": "string"
        }
        """,
        config=types.GenerateContentConfig(
            tools=[{"google_search": {}}],
            temperature=0.2
        )
    )
    print("response.text:", repr(response.text))
    
    # Try parsing
    text = response.text or ""
    text = text.strip()
    if text.startswith("```json"): text = text[7:]
    elif text.startswith("```"): text = text[3:]
    if text.endswith("```"): text = text[:-3]
    try:
        parsed = json.loads(text.strip())
        print("Successfully parsed JSON:", parsed)
    except Exception as e:
        print("Parsing failed:", e)

asyncio.run(main())
