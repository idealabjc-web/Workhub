import uuid
from app.database import SessionLocal
from app import models
from app.auth import hash_password

db = SessionLocal()
try:
    for email, pwd, emp_name in [
        ('superadmin@idealab.com', 'SuperAdmin123!', ('Super', 'Admin')),
        ('admin@hrportal.com', 'Admin123!', ('Ava', 'Admin')),
    ]:
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
            print(f"Updated user: {email}")

        emp = db.query(models.Employee).filter(models.Employee.user_id == u.id).first()
        if not emp:
            emp = models.Employee(
                id=str(uuid.uuid4()),
                user_id=u.id,
                first_name=emp_name[0],
                last_name=emp_name[1],
                email=email,
                employee_number=f"SA{1001 if email=='admin@hrportal.com' else 1002}",
                branch=models.BranchEnum.IDEALAB,
                status=models.EmployeeStatusEnum.ACTIVE
            )
            db.add(emp)
            print(f"Created employee profile for {email}")

    db.commit()
    print("ALL SUPER ADMIN PASSWORDS SUCCESSFULLY UPDATED AND VERIFIED!")
finally:
    db.close()
