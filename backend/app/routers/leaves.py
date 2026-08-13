from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/leaves", tags=["leaves"])


@router.get("", response_model=List[schemas.LeaveOut])
def list_leaves(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Leave)
    if current_user.role.value == "EMPLOYEE":
        if current_user.employee:
            query = query.filter(models.Leave.employee_id == current_user.employee.id)
    elif employee_id:
        query = query.filter(models.Leave.employee_id == employee_id)
    if status:
        query = query.filter(models.Leave.status == status)
    records = query.order_by(models.Leave.applied_at.desc()).all()
    for r in records:
        if r.employee:
            r.employee_name = f"{r.employee.first_name} {r.employee.last_name}".strip()
            r.employee_number = r.employee.employee_number
            r.branch = r.employee.branch.value if hasattr(r.employee.branch, "value") else str(r.employee.branch)
    return records


@router.post("", response_model=schemas.LeaveOut)
def apply_leave(
    payload: schemas.LeaveCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    leave = models.Leave(
        employee_id=payload.employee_id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    if leave.employee:
        leave.employee_name = f"{leave.employee.first_name} {leave.employee.last_name}".strip()
        leave.employee_number = leave.employee.employee_number
        leave.branch = leave.employee.branch.value if hasattr(leave.employee.branch, "value") else str(leave.employee.branch)
    return leave


@router.patch("/{leave_id}/status", response_model=schemas.LeaveOut)
def update_leave_status(
    leave_id: str,
    payload: schemas.LeaveStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    leave = db.query(models.Leave).filter(models.Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    leave.status = payload.status
    leave.approved_by = current_user.id
    if payload.comments:
        leave.comments = payload.comments

    # Update leave balance when approved
    if payload.status == "APPROVED":
        days = (leave.end_date - leave.start_date).days + 1
        balance = db.query(models.LeaveBalance).filter(
            models.LeaveBalance.employee_id == leave.employee_id,
            models.LeaveBalance.leave_type == leave.leave_type,
        ).first()
        if balance:
            balance.used += days

    db.commit()
    db.refresh(leave)
    if leave.employee:
        leave.employee_name = f"{leave.employee.first_name} {leave.employee.last_name}".strip()
        leave.employee_number = leave.employee.employee_number
        leave.branch = leave.employee.branch.value if hasattr(leave.employee.branch, "value") else str(leave.employee.branch)
    return leave


def get_annual_leaves_by_gender(gender: Optional[str]) -> int:
    """Female -> 12 leaves per year; Male / Other -> 6 leaves per year."""
    if gender and gender.strip().lower() in ["female", "f"]:
        return 12
    return 6


def sync_employee_leave_balances(db: Session, employee: models.Employee):
    gender_str = str(employee.gender) if employee.gender is not None else None
    quota = get_annual_leaves_by_gender(gender_str)

    for lt in models.LeaveTypeEnum:
        balance = db.query(models.LeaveBalance).filter(
            models.LeaveBalance.employee_id == employee.id,
            models.LeaveBalance.leave_type == lt,
        ).first()

        if balance:
            balance.total = quota
        else:
            db.add(models.LeaveBalance(
                employee_id=employee.id,
                leave_type=lt,
                total=quota,
                used=0,
            ))
    db.commit()


@router.get("/balances", response_model=List[schemas.LeaveBalanceOut])
def get_all_balances(
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role.value == "EMPLOYEE" and current_user.employee:
        sync_employee_leave_balances(db, current_user.employee)
        return db.query(models.LeaveBalance).filter(models.LeaveBalance.employee_id == current_user.employee.id).all()
    elif employee_id:
        emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        if emp:
            sync_employee_leave_balances(db, emp)
        return db.query(models.LeaveBalance).filter(models.LeaveBalance.employee_id == employee_id).all()

    # Sync all employees if admin/HR
    all_emps = db.query(models.Employee).all()
    for emp in all_emps:
        sync_employee_leave_balances(db, emp)

    return db.query(models.LeaveBalance).all()


@router.delete("/{leave_id}")
def delete_leave(
    leave_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    leave = db.query(models.Leave).filter(models.Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.status != "PENDING":
        raise HTTPException(status_code=400, detail="Cannot cancel non-pending leave")
    db.delete(leave)
    db.commit()
    return {"detail": "Leave cancelled"}
