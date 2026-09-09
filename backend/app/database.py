import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./hr_portal.db"

IS_SERVERLESS = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))


def _build_connect_args():
    if "sqlite" in DATABASE_URL:
        return {"check_same_thread": False}
    # PostgreSQL SSL keepalive settings to prevent
    # "SSL connection has been closed unexpectedly" errors
    return {
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
        "sslmode": "require",
    }


def _build_engine_kwargs():
    """Return engine kwargs appropriate for the runtime environment."""
    kwargs = {
        "connect_args": _build_connect_args(),
        "pool_pre_ping": True,
    }
    if "sqlite" in DATABASE_URL:
        return kwargs

    if IS_SERVERLESS:
        # Serverless: each invocation is short-lived, use NullPool
        # (fresh connection per request, no stale pool issues)
        kwargs["poolclass"] = NullPool
    else:
        # Traditional server: maintain a connection pool
        kwargs["pool_recycle"] = 270
        kwargs["pool_size"] = 5
        kwargs["max_overflow"] = 10
        kwargs["pool_timeout"] = 30
    return kwargs


engine = create_engine(DATABASE_URL, **_build_engine_kwargs())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
