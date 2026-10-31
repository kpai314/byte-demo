import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "BYTE Campus Food OS"
    app_env: str = os.getenv("APP_ENV", "development")
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"
    secret_key: str = os.getenv("SECRET_KEY", "byte-campus-development-secret-key-32chars")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 720
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/byte_campus.db")
    campus_code: str = "DJSCE"
    campus_name: str = "Dwarkadas J. Sanghvi College of Engineering"

    class Config:
        env_file = ".env"

settings = Settings()
