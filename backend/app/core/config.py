from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str
    supabase_key: str

    # App
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_env: str = "production"
    base_url: str = "http://localhost:8000"

    # Security
    webhook_secret: str = "dev-secret"
    encryption_key: str = "dev-key-replace-me-with-fernet-key=="

    # Netlify / domains (scripts/onboard.py; optional locally)
    netlify_token: str = ""
    netlify_site_id: str = ""
    domain_suffix: str = "salonflow.kz"

    # FSM бота (иначе на Cloud Run >1 инстанса состояние теряется). Пример: Upstash Redis URL
    redis_url: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()
