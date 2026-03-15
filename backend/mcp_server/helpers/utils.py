import json
import re
import logging

logger = logging.getLogger("mimesis.tools")


def _parse_json_response(text: str) -> dict:
    """Parse a JSON response from a Gemini model, with multiple fallback strategies.

    1. Strip markdown fences (```json ... ```)
    2. Try strict json.loads
    3. Fallback: extract first { ... } block via regex
    4. Fallback: attempt to fix common JSON issues (trailing commas, etc.)
    """
    if not text:
        return {}

    cleaned = _strip_markdown_fences(text)

    # Attempt 1: strict parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Attempt 2: extract the first JSON object from the text
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

        # Attempt 3: fix common issues and retry
        try:
            fixed = _fix_common_json_issues(match.group())
            return json.loads(fixed)
        except json.JSONDecodeError as e:
            logger.warning(f"⚠️ JSON repair failed: {e}")

    logger.error(f"❌ Could not parse JSON from response ({len(text)} chars)")
    return {}


def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _fix_common_json_issues(text: str) -> str:
    """Attempt to fix common LLM JSON generation mistakes."""
    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    # Remove any control characters except newlines and tabs
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return text
