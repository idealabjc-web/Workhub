"""
Vercel Serverless entry point.
Wraps the FastAPI app with Mangum so it runs as a serverless function.
"""
import os
import sys
from pathlib import Path

# Production Neon PostgreSQL database connection pooler URL
DEFAULT_DATABASE_URL = (
    "postgresql://neondb_owner:npg_NHY3C9uGfWki@ep-snowy-cherry-azfm1y9n-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
)
if not os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL", "").startswith("sqlite"):
    os.environ["DATABASE_URL"] = DEFAULT_DATABASE_URL

if not os.getenv("JWT_SECRET"):
    os.environ["JWT_SECRET"] = "idealab-workhub-super-secret-jwt-key-2026"

# Ensure the backend package is importable from the repo root
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from mangum import Mangum
from app.main import app, init_db

# Run DB migrations on cold start (lifespan events don't fire in serverless)
init_db()

# Mangum wraps the ASGI FastAPI app for serverless (AWS Lambda / Vercel)
handler = Mangum(app, lifespan="off")

