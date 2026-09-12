import functools
from pydantic_settings import BaseSettings

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class Settings(BaseSettings):
    openrouter_api_key: str
    openrouter_model: str
    openrouter_face_model: str = "google/gemini-2.5-flash"


@functools.lru_cache
def get_settings() -> Settings:
    return Settings()
