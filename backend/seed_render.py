"""
Seed script for Render PostgreSQL database.
Run with: python seed_render.py
"""
import os, uuid
from datetime import date, timedelta

os.environ["DATABASE_URL"] = (
    "postgresql://hr_portal_db_7vxl_user:12nqBSzRJE8USES8NfrrImWRL2MesG4g"
    "@dpg-d9s9av942hec73btrcg0-a.oregon-postgres.render.com/hr_portal_db_7vxl"
)

from app.database import Base, engine, SessionLocal
from app import models
from app.auth import hash_password

print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Tables created.")

db = SessionLocal()

# ── helpers ──────────────────────────────────────────────────────────────────
def make_user(email, password, role):
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        print(f"  User {email} already exists, skipping.")
        return existing
    u = models.User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(u)
    db.flush()
    return u

# ── Departments ───────────────────────────────────────────────────────────────
def get_or_create_dept(name):
    d = db.query(models.Department).filter(models.Department.name == name).first()
    if not d:
        d = models.Department(id=str(uuid.uuid4()), name=name)
        db.add(d)
        db.flush()
    return d

dept_it  = get_or_create_dept("IT")
dept_hr  = get_or_create_dept("HR")
dept_fin = get_or_create_dept("Finance")
dept_ops = get_or_create_dept("Operations")

# ── Super Admin ───────────────────────────────────────────────────────────────
admin_user = make_user("admin@hrportal.com", "Admin123!", models.UserRole.SUPER_ADMIN)

# ── HR Manager ────────────────────────────────────────────────────────────────
hr_user = make_user("alluriroshitha999@gmail.com", "Hr123!", models.UserRoleEnum.HR)

existing_hr_emp = db.query(models.Employee).filter(models.Employee.user_id == hr_user.id).first()
if not existing_hr_emp:
    hr_emp = models.Employee(
        id=str(uuid.uuid4()),
        user_id=hr_user.id,
        first_name="Roshitha",
        last_name="Alluri",
        email="alluriroshitha999@gmail.com",
        phone="9989642229",
        blood_group="A+",
        gender="Female",
        date_of_birth=date(2000, 9, 1),
        department_id=dept_hr.id,
        designation="HR Manager",
        date_of_joining=date(2024, 9, 2),
        basic_salary=75000,
        status=models.EmployeeStatusEnum.ACTIVE,
        branch=models.BranchEnum.IDEALAB,
    )
    db.add(hr_emp)
    db.flush()

# ── Employee ──────────────────────────────────────────────────────────────────
emp_user = make_user("sheebathimmapuram@gmail.com", "Employee123!", models.UserRole.EMPLOYEE)

existing_emp = db.query(models.Employee).filter(models.Employee.user_id == emp_user.id).first()
if not existing_emp:
    emp = models.Employee(
        id=str(uuid.uuid4()),
        user_id=emp_user.id,
        first_name="Sheeba",
        last_name="Thimmapuram",
        email="sheebathimmapuram@gmail.com",
        department_id=dept_it.id,
        position="Software Developer",
        date_of_joining=date(2023, 6, 1),
        basic_salary=45000,
        status="ACTIVE",
        branch="IDEALAB",
    )
    db.add(emp)
    db.flush()

# ── Holidays ──────────────────────────────────────────────────────────────────
holidays = [
    ("Republic Day", date(2025, 1, 26)),
    ("Holi", date(2025, 3, 14)),
    ("Ram Navami", date(2025, 4, 6)),
    ("Independence Day", date(2025, 8, 15)),
    ("Gandhi Jayanti", date(2025, 10, 2)),
    ("Diwali", date(2025, 10, 20)),
    ("Christmas", date(2025, 12, 25)),
]
for name, hdate in holidays:
    existing = db.query(models.Holiday).filter(models.Holiday.date == hdate).first()
    if not existing:
        db.add(models.Holiday(id=str(uuid.uuid4()), name=name, date=hdate))

# ── Announcements ─────────────────────────────────────────────────────────────
if db.query(models.Announcement).count() == 0:
    db.add(models.Announcement(
        id=str(uuid.uuid4()),
        title="Welcome to LOTUS-HR Portal!",
        content="We are excited to launch our new HR portal. Please update your profile and explore all features.",
        priority="HIGH",
    ))
    db.add(models.Announcement(
        id=str(uuid.uuid4()),
        title="Q3 Performance Reviews",
        content="Performance reviews for Q3 will begin next week. Please complete your self-assessment forms.",
        priority="MEDIUM",
    ))

db.commit()
db.close()

print("\n✅ Database seeded successfully!")
print("Login credentials:")
print("  Super Admin : admin@hrportal.com / Admin123!")
print("  HR Manager  : hr@hrportal.com / Hr123!")
print("  Employee    : sheebathimmapuram@gmail.com / Employee123!")
