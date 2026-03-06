from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file (backend/config.py → project root/.env)
# This works regardless of which directory uvicorn is launched from.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables / .env file.
    pydantic-settings handles .env parsing natively — no load_dotenv() needed.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",  # silently ignore unknown env vars
    )

    openai_api_key: str = ""
    material2050_api_key: str = ""


settings = Settings()
