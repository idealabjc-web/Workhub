import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import decode_access_token
from app.database import get_db
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])
security = HTTPBearer()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    try:
        payload = decode_access_token(creds.credentials)
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/complete")
def complete_onboarding(
    payload: schemas.OnboardingRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Called after first login — creates/updates the employee record and marks profile as complete."""

    # Parse dates
    doj = None
    dob = None
    try:
        if payload.date_of_joining:
            doj = date.fromisoformat(payload.date_of_joining)
    except ValueError:
        doj = date.today()
    try:
        if payload.date_of_birth:
            dob = date.fromisoformat(payload.date_of_birth)
    except ValueError:
        dob = None

    # Map branch string to enum
    branch_map = {
        "IDEALAB": models.BranchEnum.IDEALAB,
        "UGC": models.BranchEnum.UGC,
        "VIZAG": models.BranchEnum.VIZAG,
    }
    branch = branch_map.get(payload.branch.upper(), models.BranchEnum.IDEALAB)

    # Map employment type
    emp_type_map = {
        "Full-Time": models.EmploymentTypeEnum.FULL_TIME,
        "WFH": models.EmploymentTypeEnum.FULL_TIME,  # WFH is still full-time
        "Part-Time": models.EmploymentTypeEnum.PART_TIME,
        "Contract": models.EmploymentTypeEnum.CONTRACT,
        "Intern": models.EmploymentTypeEnum.INTERN,
    }
    emp_type = emp_type_map.get(payload.employment_type, models.EmploymentTypeEnum.FULL_TIME)

    # Generate employee number
    count = db.query(models.Employee).count()
    emp_number = f"EMP{str(count + 1).zfill(4)}"

    # Create or update employee record
    emp = db.query(models.Employee).filter(models.Employee.user_id == current_user.id).first()
    if emp:
        emp.first_name = payload.first_name
        emp.last_name = payload.last_name
        emp.email = payload.email
        emp.phone = payload.phone
        emp.profile_photo_url = payload.profile_photo_url
        emp.branch = branch
        emp.employment_type = emp_type
        emp.designation = payload.designation
        emp.date_of_joining = doj or date.today()
        emp.date_of_birth = dob
    else:
        emp = models.Employee(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            employee_number=emp_number,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            phone=payload.phone,
            profile_photo_url=payload.profile_photo_url,
            branch=branch,
            employment_type=emp_type,
            designation=payload.designation,
            date_of_joining=doj or date.today(),
            date_of_birth=dob,
            status=models.EmployeeStatusEnum.ACTIVE,
            basic_salary=0.0,
        )
        db.add(emp)

    # Mark profile as complete
    current_user.profile_complete = True

    db.commit()
    db.refresh(emp)

    return {
        "message": "Profile completed successfully",
        "employee_id": emp.id,
        "full_name": f"{emp.first_name} {emp.last_name}",
    }
