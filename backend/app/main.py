import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import Base, engine
from app.routers import (
    announcements,
    attendance,
    auth,
    dashboard,
    departments,
    documents,
    employees,
    events,
    expenses,
    holidays,
    leaves,
    moments,
    notifications,
    onboarding,
    payroll,
    revenue,
    settings,
    teams,
)

# Ensure tables are created safely without blocking module import
try:
    Base.metadata.create_all(bind=engine)
except Exception as err:
    print("Startup table creation note:", err)

def auto_migrate_db():
    """Ensure newly added columns exist in existing PostgreSQL / SQLite tables."""
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lat FLOAT;"))
            conn.execute(text("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lng FLOAT;"))
            conn.execute(text("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lat FLOAT;"))
            conn.execute(text("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lng FLOAT;"))
            conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_id VARCHAR;"))
            conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_name VARCHAR;"))
            conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;"))
            conn.commit()
            print("Auto-migration: Ensured database columns exist.")
    except Exception as e:
        print("Auto-migration note:", e)

try:
    auto_migrate_db()
except Exception as e:
    print("Startup auto-migration note:", e)

app = FastAPI(title="LOTUS-HR Portal API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    origin = request.headers.get("origin") or "*"

    if request.method == "OPTIONS":
        response = JSONResponse(status_code=200, content={"status": "ok"})
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

    try:
        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    except Exception as exc:
        print("UNHANDLED EXCEPTION:", exc)
        traceback.print_exc()
        response = JSONResponse(
            status_code=500,
            content={"detail": str(exc), "trace": traceback.format_exc()},
        )
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

# Core HR & Operations Routers
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(departments.router)
app.include_router(attendance.router)
app.include_router(leaves.router)
app.include_router(payroll.router)
app.include_router(holidays.router)
app.include_router(dashboard.router)
app.include_router(revenue.router)
app.include_router(moments.router)
app.include_router(expenses.router)
app.include_router(events.router)
app.include_router(announcements.router)
app.include_router(documents.router)
app.include_router(notifications.router)
app.include_router(onboarding.router)
app.include_router(teams.router)
app.include_router(settings.router)


@app.get("/")
def root():
    return {
        "message": "Welcome to LOTUS-HR Portal API",
        "docs": "/docs",
        "version": "2.1.0",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}
