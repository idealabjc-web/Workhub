import uuid, datetime
from sqlalchemy import text
from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app import models
from app.routers.leaves import sync_employee_leave_balances
from app.routers.employees import next_employee_number

db = SessionLocal()

try:
    db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE"))
    db.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_id VARCHAR"))
    db.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_name VARCHAR"))
    db.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo_url TEXT"))
    db.commit()
    email = "alluriroshitha999@gmail.com"
    first_name = "Roshitha"
    last_name = "Alluri"
    phone = "9989642229"
    blood_group = "A+"
    gender = "Female"
    doj = datetime.date(2024, 9, 2)
    dob = datetime.date(2000, 9, 1)
    designation = "HR Manager"
    branch = models.BranchEnum.IDEALAB
    emp_type = models.EmploymentTypeEnum.FULL_TIME

    # Check if User exists
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            id=str(uuid.uuid4()),
            email=email,
            hashed_password=hash_password("Hr123!"),
            role=models.UserRoleEnum.HR,
            profile_complete=True,
            is_active=True,
        )
        db.add(user)
        db.flush()
        print(f"Created HR User: {email}")
    else:
        user.role = models.UserRoleEnum.HR
        user.profile_complete = True
        user.is_active = True
        db.flush()
        print(f"Updated HR User: {email}")

    # Check if Employee exists
    emp = db.query(models.Employee).filter(models.Employee.email == email).first()
    if not emp:
        emp = db.query(models.Employee).filter(models.Employee.user_id == user.id).first()

    if not emp:
        emp_number = next_employee_number(db)
        emp = models.Employee(
            id=str(uuid.uuid4()),
            user_id=user.id,
            employee_number=emp_number,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            blood_group=blood_group,
            date_of_birth=dob,
            gender=gender,
            date_of_joining=doj,
            designation=designation,
            branch=branch,
            employment_type=emp_type,
            status=models.EmployeeStatusEnum.ACTIVE,
            basic_salary=75000.0,
        )
        db.add(emp)
        print(f"Created HR Employee record: {first_name} {last_name}")
    else:
        emp.user_id = user.id
        emp.first_name = first_name
        emp.last_name = last_name
        emp.email = email
        emp.phone = phone
        emp.blood_group = blood_group
        emp.date_of_birth = dob
        emp.gender = gender
        emp.date_of_joining = doj
        emp.designation = designation
        emp.branch = branch
        emp.employment_type = emp_type
        emp.status = models.EmployeeStatusEnum.ACTIVE
        print(f"Updated HR Employee record: {first_name} {last_name}")

    db.commit()
    db.refresh(emp)

    # Sync female 12 leave quota
    sync_employee_leave_balances(db, emp)
    db.commit()

    print("SUCCESSFULLY SEEDED ROSHITHA ALLURI AS HR MANAGER!")
    print(f"Name: {emp.first_name} {emp.last_name}")
    print(f"Email: {emp.email}")
    print(f"DOJ: {emp.date_of_joining}")
    print(f"DOB: {emp.date_of_birth}")
    print(f"Gender: {emp.gender}")
    print(f"Phone: {emp.phone}")

except Exception as e:
    db.rollback()
    print("ERROR:", e)

finally:
    db.close()
