import json

text = '```json\n{\n "brand_name": "Rolex"\n}\n```\n'
text = text.strip()
if text.startswith("```json"): text = text[7:]
elif text.startswith("```"): text = text[3:]
if text.endswith("```"): text = text[:-3]
print(json.loads(text.strip()))
