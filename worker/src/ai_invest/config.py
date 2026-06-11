from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://ai_invest:ai_invest@127.0.0.1:5441/ai_invest"

    openrouter_api_key: str = ""
    digest_model: str = "deepseek/deepseek-chat"

    telegram_bot_token: str = ""
    telegram_channel_id: str = ""  # "@channel_name" или "-100..."

    max_bot_token: str = ""
    max_channel_id: str = ""  # числовой chat_id канала в MAX (узнать: ai-invest max-chats)


settings = Settings()
