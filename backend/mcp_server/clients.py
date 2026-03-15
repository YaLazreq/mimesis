"""Shared API clients."""
from google import genai
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("../.env")

genai_client = genai.Client()
