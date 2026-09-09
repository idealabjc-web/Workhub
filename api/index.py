"""
Vercel Serverless entry point.
Wraps the FastAPI app with Mangum so it runs as a serverless function.
"""
import sys
from pathlib import Path

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

