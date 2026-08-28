import traceback
from contextlib import asynccontextmanager
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


def init_db():
    """Create tables and run migrations — called once at startup."""
    try:
        Base.metadata.create_all(bind=engine)
        print("DB tables ensured.")
    except Exception as err:
        print("Startup table creation note:", err)

    migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lat FLOAT;",
        "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_lng FLOAT;",
        "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lat FLOAT;",
        "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_lng FLOAT;",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_id VARCHAR;",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_name VARCHAR;",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_wfh_allowed BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_url TEXT;",
    ]

    try:
        with engine.begin() as conn:
            for stmt in migrations:
                try:
                    conn.execute(text(stmt))
                except Exception:
                    if "IF NOT EXISTS" in stmt:
                        try:
                            conn.execute(text(stmt.replace(" IF NOT EXISTS", "")))
                        except Exception:
                            pass
        print("Auto-migration complete.")
        try:
            with engine.begin() as conn:
                conn.execute(text("INSERT INTO system_settings (id, key, value) SELECT 'remote_def_id', 'allow_remote_checkin', 'false' WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'allow_remote_checkin');"))
                
                # 1. Update existing records for Sruthi Reddy, Safura Tahseen, and Sarva Srilaksmi to WFH allowed
                conn.execute(text("""
                    UPDATE employees 
                    SET is_wfh_allowed = TRUE 
                    WHERE LOWER(first_name) LIKE '%sruthi%' 
                       OR LOWER(last_name) LIKE '%sruthi%' 
                       OR LOWER(first_name) LIKE '%safura%' 
                       OR LOWER(last_name) LIKE '%safura%' 
                       OR LOWER(first_name) LIKE '%sarva%' 
                       OR LOWER(last_name) LIKE '%sarva%'
                       OR LOWER(first_name) LIKE '%srilaksmi%'
                       OR LOWER(last_name) LIKE '%srilaksmi%'
                       OR LOWER(first_name) LIKE '%tahseen%'
                       OR LOWER(last_name) LIKE '%tahseen%';
                """))

                # 2. Ensure Sruthi Reddy, Safura Tahseen, and Sarva Srilaksmi records exist in database
                wfh_staff = [
                    ("sruthi.reddy@idealab.com", "Sruthi", "Reddy"),
                    ("safura.tahseen@idealab.com", "Safura", "Tahseen"),
                    ("sarva.srilaksmi@idealab.com", "Sarva", "Srilaksmi"),
                ]
                import uuid
                from datetime import date
                for email, fname, lname in wfh_staff:
                    res = conn.execute(text("SELECT id FROM employees WHERE LOWER(first_name) = :fname OR LOWER(email) = :email;"), {"fname": fname.lower(), "email": email.lower()}).fetchone()
                    if not res:
                        emp_id = str(uuid.uuid4())
                        emp_num = f"EMP{uuid.uuid4().hex[:4].upper()}"
                        conn.execute(
                            text("""
                                INSERT INTO employees (id, employee_number, first_name, last_name, email, branch, status, employment_type, is_wfh_allowed, date_of_joining)
                                VALUES (:id, :num, :fname, :lname, :email, 'IDEALAB', 'Active', 'Full-time', TRUE, :doj);
                            """),
                            {"id": emp_id, "num": emp_num, "fname": fname, "lname": lname, "email": email, "doj": date.today()}
                        )
                        conn.execute(text("UPDATE employees SET is_wfh_allowed = TRUE WHERE id = :id;"), {"id": emp_id})
        except Exception as err_wfh:
            print("WFH employee auto-setup note:", err_wfh)
    except Exception as e:
        print("Auto-migration note:", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="LOTUS-HR Portal API", version="2.1.0", lifespan=lifespan)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def cors_and_exceptions_middleware(request: Request, call_next):
    origin = request.headers.get("origin") or "*"

    # Always handle CORS preflight immediately
    if request.method == "OPTIONS":
        response = JSONResponse(status_code=200, content={"status": "ok"})
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response

    try:
        response = await call_next(request)
    except Exception as exc:
        print("UNHANDLED EXCEPTION:", exc)
        traceback.print_exc()
        response = JSONResponse(
            status_code=500,
            content={"detail": str(exc)},
        )

    # Inject CORS headers on every response
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


# ── Routers ───────────────────────────────────────────────────────────────────
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
