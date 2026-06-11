from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ai_invest.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Session:
    return SessionLocal()
