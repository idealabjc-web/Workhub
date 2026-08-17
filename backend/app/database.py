import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://hr_portal_db_7vxl_user:12nqBSzRJE8USES8NfrrImWRL2MesG4g@dpg-d9s9av942hec73btrcg0-a.oregon-postgres.render.com/hr_portal_db_7vxl?sslmode=require",
)

if DATABASE_URL and "render.com" in DATABASE_URL and "sslmode" not in DATABASE_URL:
    DATABASE_URL += "?sslmode=require"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
