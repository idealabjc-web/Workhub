import os, uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

RENDER_DB_URL = "postgresql://hr_portal_db_7vxl_user:12nqBSzRJE8USES8NfrrImWRL2MesG4g@dpg-d9s9av942hec73btrcg0-a.oregon-postgres.render.com/hr_portal_db_7vxl"

engine = create_engine(RENDER_DB_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app import models
from app.auth import hash_password

db = SessionLocal()

accounts = [
    ("superadmin@hrportal.com", "SuperAdmin123!", ("Super", "Admin"), "SA1000"),
    ("admin@hrportal.com", "Admin123!", ("Ava", "Admin"), "SA1001"),
    ("superadmin@idealab.com", "SuperAdmin123!", ("Super", "Admin"), "SA1002"),
]

try:
    for email, pwd, emp_name, emp_num in accounts:
        u = db.query(models.User).filter(models.User.email == email).first()
        if not u:
            u = models.User(
                id=str(uuid.uuid4()),
                email=email,
                hashed_password=hash_password(pwd),
                role=models.UserRoleEnum.SUPER_ADMIN,
                is_active=True
            )
            db.add(u)
            db.flush()
            print(f"Created user: {email}")
        else:
            u.hashed_password = hash_password(pwd)
            u.role = models.UserRoleEnum.SUPER_ADMIN
            u.is_active = True
            db.flush()
            print(f"Updated user: {email}")

        emp = db.query(models.Employee).filter(models.Employee.user_id == u.id).first()
        if not emp:
            emp = models.Employee(
                id=str(uuid.uuid4()),
                user_id=u.id,
                first_name=emp_name[0],
                last_name=emp_name[1],
                email=email,
                employee_number=emp_num,
                branch=models.BranchEnum.IDEALAB,
                status=models.EmployeeStatusEnum.ACTIVE
            )
            db.add(emp)
            print(f"Created employee profile for {email}")

    db.commit()
    print("RENDER PRODUCTION DATABASE SUCCESSFULLY UPDATED!")
finally:
    db.close()
