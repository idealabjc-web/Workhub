import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.auth import hash_password, verify_password
from app.database import engine as local_engine

RENDER_DB_URL = "postgresql://hr_portal_db_7vxl_user:12nqBSzRJE8USES8NfrrImWRL2MesG4g@dpg-d9s9av942hec73btrcg0-a.oregon-postgres.render.com/hr_portal_db_7vxl"
render_engine = create_engine(RENDER_DB_URL, pool_pre_ping=True)

LocalSession = sessionmaker(autocommit=False, autoflush=False, bind=local_engine)
RenderSession = sessionmaker(autocommit=False, autoflush=False, bind=render_engine)

accounts = [
    ("superadmin@hrportal.com", "SuperAdmin123!", ("Super", "Admin"), "SA1000"),
    ("admin@hrportal.com", "Admin123!", ("Ava", "Admin"), "SA1001"),
    ("superadmin@idealab.com", "SuperAdmin123!", ("Super", "Admin"), "SA1002"),
]

def sync_db(session_cls, db_label):
    print(f"\n--- Syncing {db_label} ---")
    db = session_cls()
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
                print(f"[{db_label}] Created user: {email}")
            else:
                u.hashed_password = hash_password(pwd)
                u.role = models.UserRoleEnum.SUPER_ADMIN
                u.is_active = True
                db.flush()
                print(f"[{db_label}] Updated user: {email}")

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
                print(f"[{db_label}] Created employee profile: {email}")

        db.commit()

        # VERIFY LOGINS
        print(f"--- Verifying {db_label} Logins ---")
        for email, pwd, _, _ in accounts:
            user = db.query(models.User).filter(models.User.email == email).first()
            ok = user and verify_password(pwd, user.hashed_password)
            print(f"[{db_label}] Login check '{email}' with '{pwd}': {'SUCCESS 200' if ok else 'FAILED'}")

    finally:
        db.close()

sync_db(LocalSession, "LOCAL DB")
sync_db(RenderSession, "RENDER DB")
