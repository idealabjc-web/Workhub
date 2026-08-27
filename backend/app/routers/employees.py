from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import hash_password
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/employees", tags=["employees"])


def next_employee_number(db: Session) -> str:
    employees = db.query(models.Employee.employee_number).all()
    max_num = 0
    for (emp_num,) in employees:
        if emp_num:
            digits = "".join(filter(str.isdigit, emp_num))
            if digits:
                max_num = max(max_num, int(digits))
    
    next_val = max_num + 1 if max_num > 0 else 1
    while True:
        candidate = f"EMP{str(next_val).zfill(4)}"
        exists = db.query(models.Employee).filter(models.Employee.employee_number == candidate).first()
        if not exists:
            return candidate
        next_val += 1


@router.get("", response_model=List[schemas.EmployeeOut])
def list_employees(
    search: Optional[str] = None,
    branch: Optional[str] = None,
    department_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER", "FINANCE"])),
):
    query = db.query(models.Employee)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (models.Employee.first_name.ilike(like))
            | (models.Employee.last_name.ilike(like))
            | (models.Employee.email.ilike(like))
            | (models.Employee.employee_number.ilike(like))
            | (models.Employee.designation.ilike(like))
        )
    if branch:
        query = query.filter(models.Employee.branch == branch)
    if department_id:
        query = query.filter(models.Employee.department_id == department_id)
    if status:
        query = query.filter(models.Employee.status == status)
    return query.order_by(models.Employee.created_at.desc()).all()


@router.post("", response_model=schemas.EmployeeOut)
def create_employee(
    payload: schemas.EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.flush()

    employee = models.Employee(
        user_id=user.id,
        employee_number=next_employee_number(db),
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        blood_group=payload.blood_group,
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        address=payload.address,
        emergency_contact=payload.emergency_contact,
        date_of_joining=date.today(),
        department_id=payload.department_id,
        designation=payload.designation,
        reporting_manager_id=payload.reporting_manager_id,
        branch=payload.branch,
        employment_type=payload.employment_type,
        basic_salary=payload.basic_salary,
        is_wfh_allowed=payload.is_wfh_allowed or False,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    from app.routers.leaves import sync_employee_leave_balances
    sync_employee_leave_balances(db, employee)

    return employee


@router.post("/import")
def import_employees(
    payload: schemas.ImportEmployeesRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    created = 0
    for emp in payload.employees:
        if not emp.email or "@" not in emp.email:
            continue
        existing = db.query(models.User).filter(models.User.email == emp.email).first()
        if existing:
            continue

        # Sanitize role & branch enums safely
        valid_role = "EMPLOYEE"
        if emp.role:
            r_str = emp.role.upper()
            if r_str in ["SUPER_ADMIN", "HR", "MANAGER", "FINANCE", "EMPLOYEE"]:
                valid_role = r_str

        valid_branch = "IDEALAB"
        if emp.branch:
            b_str = emp.branch.upper()
            if b_str in ["IDEALAB", "UGC", "VIZAG"]:
                valid_branch = b_str

        user = models.User(
            email=emp.email,
            hashed_password=hash_password(emp.password or "Employee123!"),
            role=valid_role,
        )
        db.add(user)
        db.flush()

        employee = models.Employee(
            user_id=user.id,
            employee_number=next_employee_number(db),
            first_name=emp.first_name or "New",
            last_name=emp.last_name or "Employee",
            email=emp.email,
            phone=emp.phone or None,
            branch=valid_branch,
            designation=emp.designation or None,
            employment_type=emp.employment_type or "Full-Time",
            basic_salary=emp.basic_salary or 50000.0,
        )
        db.add(employee)
        db.commit()
        db.refresh(employee)

        from app.routers.leaves import sync_employee_leave_balances
        sync_employee_leave_balances(db, employee)
        created += 1

    db.commit()
    return {"imported": created}


@router.get("/me", response_model=schemas.EmployeeOut)
def get_my_employee_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from app.routers.attendance import get_or_create_user_employee
    emp = get_or_create_user_employee(db, current_user)
    if not emp.date_of_joining:
        setattr(emp, "date_of_joining", date.today())
        db.commit()
        db.refresh(emp)
    return emp


@router.get("/{employee_id}", response_model=schemas.EmployeeOut)
def get_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role.value == "EMPLOYEE":
        if not current_user.employee or current_user.employee.id != employee_id:
            raise HTTPException(status_code=403, detail="Access denied: You can only view your own profile")

    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


def apply_employee_updates(db: Session, employee: models.Employee, data: dict):
    if "employee_number" in data and data["employee_number"]:
        emp_num = str(data["employee_number"]).strip()
        if emp_num != employee.employee_number:
            existing = db.query(models.Employee).filter(
                models.Employee.employee_number == emp_num,
                models.Employee.id != employee.id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Employee number '{emp_num}' is already assigned to {existing.first_name} {existing.last_name}."
                )
            data["employee_number"] = emp_num

    if "email" in data and data["email"]:
        email_val = str(data["email"]).strip().lower()
        if email_val != employee.email.lower():
            existing = db.query(models.Employee).filter(
                models.Employee.email == email_val,
                models.Employee.id != employee.id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Email address '{email_val}' is already assigned to another staff member."
                )
            data["email"] = email_val

    for field, value in data.items():
        setattr(employee, field, value)

    try:
        db.commit()
        db.refresh(employee)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Failed to save changes. Duplicate employee number or email detected."
        )

    from app.routers.leaves import sync_employee_leave_balances
    sync_employee_leave_balances(db, employee)
    return employee


@router.patch("/me", response_model=schemas.EmployeeOut)
def update_my_employee_profile(
    payload: schemas.EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from app.routers.attendance import get_or_create_user_employee
    employee = get_or_create_user_employee(db, current_user)
    data = payload.model_dump(exclude_unset=True)
    return apply_employee_updates(db, employee, data)


@router.patch("/{employee_id}", response_model=schemas.EmployeeOut)
def update_employee(
    employee_id: str,
    payload: schemas.EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if employee_id == "me":
        return update_my_employee_profile(payload, db, current_user)

    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    is_self = (current_user.employee and current_user.employee.id == employee_id) or current_user.email == employee.email
    is_hr = current_user.role.value in ["SUPER_ADMIN", "HR"]

    if not (is_self or is_hr):
        raise HTTPException(status_code=403, detail="Access denied")

    data = payload.model_dump(exclude_unset=True)
    return apply_employee_updates(db, employee, data)


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(employee)
    db.commit()
    return {"detail": "Employee deleted"}


@router.get("/{employee_id}/documents", response_model=List[schemas.EmployeeDocumentOut])
def get_employee_documents(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role.value == "EMPLOYEE" and (not current_user.employee or current_user.employee.id != employee_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(models.EmployeeDocument).filter(
        models.EmployeeDocument.employee_id == employee_id
    ).all()


@router.post("/{employee_id}/documents", response_model=schemas.EmployeeDocumentOut)
def add_employee_document(
    employee_id: str,
    payload: schemas.EmployeeDocumentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    doc = models.EmployeeDocument(
        employee_id=employee_id,
        doc_type=payload.doc_type,
        file_name=payload.file_name,
        file_url=payload.file_url,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{employee_id}/documents/{doc_id}")
def delete_employee_document(
    employee_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    doc = db.query(models.EmployeeDocument).filter(
        models.EmployeeDocument.id == doc_id,
        models.EmployeeDocument.employee_id == employee_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"detail": "Document deleted"}


@router.patch("/{employee_id}/documents/{doc_id}", response_model=schemas.EmployeeDocumentOut)
def update_employee_document(
    employee_id: str,
    doc_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    doc = db.query(models.EmployeeDocument).filter(
        models.EmployeeDocument.id == doc_id,
        models.EmployeeDocument.employee_id == employee_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if "file_url" in payload and payload["file_url"]:
        doc.file_url = payload["file_url"]
    if "file_name" in payload and payload["file_name"]:
        doc.file_name = payload["file_name"]
    if "doc_type" in payload and payload["doc_type"]:
        doc.doc_type = payload["doc_type"]

    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{employee_id}/leave-balances", response_model=List[schemas.LeaveBalanceOut])
def get_employee_leave_balances(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.LeaveBalance).filter(
        models.LeaveBalance.employee_id == employee_id
    ).all()
