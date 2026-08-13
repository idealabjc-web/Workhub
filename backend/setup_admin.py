import uuid
from app.database import SessionLocal
from app import models
from app.auth import hash_password

db = SessionLocal()

# 1. Primary Super Admin
u1 = db.query(models.User).filter(models.User.email == 'admin@hrportal.com').first()
if not u1:
    u1 = models.User(
        id=str(uuid.uuid4()),
        email='admin@hrportal.com',
        hashed_password=hash_password('Admin123!'),
        role=models.UserRoleEnum.SUPER_ADMIN,
        is_active=True
    )
    db.add(u1)
    db.flush()
else:
    u1.hashed_password = hash_password('Admin123!')
    u1.role = models.UserRoleEnum.SUPER_ADMIN
    u1.is_active = True

emp1 = db.query(models.Employee).filter(models.Employee.user_id == u1.id).first()
if not emp1:
    emp1 = models.Employee(
        id=str(uuid.uuid4()),
        user_id=u1.id,
        first_name='Ava',
        last_name='Admin',
        email='admin@hrportal.com',
        employee_number='SA1001',
        branch=models.BranchEnum.IDEALAB,
        status=models.EmployeeStatusEnum.ACTIVE
    )
    db.add(emp1)

# 2. Second Super Admin Account
u2 = db.query(models.User).filter(models.User.email == 'superadmin@idealab.com').first()
if not u2:
    u2 = models.User(
        id=str(uuid.uuid4()),
        email='superadmin@idealab.com',
        hashed_password=hash_password('SuperAdmin123!'),
        role=models.UserRoleEnum.SUPER_ADMIN,
        is_active=True
    )
    db.add(u2)
    db.flush()
else:
    u2.hashed_password = hash_password('SuperAdmin123!')
    u2.role = models.UserRoleEnum.SUPER_ADMIN
    u2.is_active = True

emp2 = db.query(models.Employee).filter(models.Employee.user_id == u2.id).first()
if not emp2:
    emp2 = models.Employee(
        id=str(uuid.uuid4()),
        user_id=u2.id,
        first_name='Super',
        last_name='Admin',
        email='superadmin@idealab.com',
        employee_number='SA1002',
        branch=models.BranchEnum.IDEALAB,
        status=models.EmployeeStatusEnum.ACTIVE
    )
    db.add(emp2)

db.commit()
print("SUPER ADMIN CREATION SUCCESSFUL!")
db.close()
