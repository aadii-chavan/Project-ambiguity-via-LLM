from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    gemini_api_key: str = Field(default="", validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY"))
    llm_enabled: bool = True  # set false to force the offline rules engine (used by e2e tests)
    llm_model: str = "gemini-2.5-flash"
    thinking_budget: int = 0  # 0 = off (fast/cheap); raise (e.g. 1024) for harder documents
    database_url: str = f"sqlite:///{BASE_DIR / 'reqclear.db'}"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    max_requirements: int = 200
    max_upload_bytes: int = 2_000_000


settings = Settings()
