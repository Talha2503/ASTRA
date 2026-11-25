import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

from app.core.config import settings

# On Vercel every request may run in a fresh short-lived function, so connections are not
# kept open between requests (Neon's pooler handles that side). Locally a normal pool is used,
# and pool_pre_ping drops connections that went stale while the database was asleep.
if os.environ.get("VERCEL"):
    engine = create_engine(settings.DATABASE_URL, poolclass=NullPool)
else:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()