import json
import logging
from typing import Protocol

from google import genai
from google.genai import types

from app.config import settings

log = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


class LLMClient(Protocol):
    async def generate_json(self, system: str, user: str, spec: dict) -> dict:
        """`spec` = {"name": str, "input_schema": JSON-schema}. Returns an object matching the schema."""


class GeminiClient:
    """Schema-constrained JSON output via Gemini's structured-output mode."""

    def __init__(self, api_key: str, model: str):
        self._c = genai.Client(api_key=api_key, http_options=types.HttpOptions(
            timeout=60_000,  # ms
            retry_options=types.HttpRetryOptions(attempts=4, initial_delay=1.0, max_delay=10.0, http_status_codes=[429, 500, 502, 503, 504]),
        ))
        self._model = model

    async def generate_json(self, system: str, user: str, spec: dict) -> dict:
        cfg = types.GenerateContentConfig(
            system_instruction=system, temperature=0.0, max_output_tokens=2048,
            response_mime_type="application/json", response_json_schema=spec["input_schema"],
            thinking_config=types.ThinkingConfig(thinking_budget=settings.thinking_budget),
        )
        try:
            r = await self._c.aio.models.generate_content(model=self._model, contents=user, config=cfg)
        except Exception as e:
            log.warning("LLM call failed: %s", type(e).__name__)
            raise LLMError(type(e).__name__) from e
        try:
            data = json.loads(r.text or "")
        except (json.JSONDecodeError, ValueError) as e:
            raise LLMError("Model returned invalid JSON") from e
        if not isinstance(data, dict):
            raise LLMError("Model returned non-object JSON")
        return data


def get_llm() -> LLMClient | None:
    if not settings.llm_enabled or not settings.gemini_api_key:
        return None
    return GeminiClient(settings.gemini_api_key, settings.llm_model)
