import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

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

Base.metadata.create_all(bind=engine)

app = FastAPI(title="HR Portal API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        print("UNHANDLED EXCEPTION:", exc)
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "trace": traceback.format_exc()},
        )

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
        "message": "Welcome to HR Management Portal API",
        "docs": "/docs",
        "version": "2.1.0",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}
