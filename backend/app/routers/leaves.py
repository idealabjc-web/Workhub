from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_leave_approver, require_roles

router = APIRouter(prefix="/api/leaves", tags=["leaves"])


@router.get("", response_model=List[schemas.LeaveOut])
def list_leaves(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Leave).options(joinedload(models.Leave.employee))
    if current_user.role.value == "EMPLOYEE":
        if current_user.employee:
            query = query.filter(models.Leave.employee_id == current_user.employee.id)
    elif employee_id:
        query = query.filter(models.Leave.employee_id == employee_id)
    if status:
        query = query.filter(models.Leave.status == status)
    return query.order_by(models.Leave.applied_at.desc()).all()


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
    return leave


@router.patch("/{leave_id}/status", response_model=schemas.LeaveOut)
def update_leave_status(
    leave_id: str,
    payload: schemas.LeaveStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_leave_approver()),
):
    leave = db.query(models.Leave).filter(models.Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    leave.status = payload.status
    leave.approved_by = current_user.id
    if payload.comments:
        leave.comments = payload.comments

    db.commit()
    db.refresh(leave)

    # Sync and recalculate leave balances whenever status changes
    emp = db.query(models.Employee).filter(models.Employee.id == leave.employee_id).first()
    if emp:
        sync_employee_leave_balances(db, emp)

    return leave


@router.patch("/{leave_id}", response_model=schemas.LeaveOut)
def update_leave(
    leave_id: str,
    payload: schemas.LeaveUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    leave = db.query(models.Leave).filter(models.Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    # Employee can only edit their own leave. Super Admin, HR, Manager can edit any.
    if current_user.role.value == "EMPLOYEE":
        if not current_user.employee or leave.employee_id != current_user.employee.id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this leave")
        if leave.status != "PENDING":
            raise HTTPException(status_code=400, detail="Cannot edit a non-pending leave request")

    if payload.reason is not None:
        leave.reason = payload.reason
    if payload.leave_type is not None:
        leave.leave_type = payload.leave_type
    if payload.start_date is not None:
        leave.start_date = payload.start_date
    if payload.end_date is not None:
        if payload.end_date < (payload.start_date or leave.start_date):
            raise HTTPException(status_code=400, detail="End date must be after start date")
        leave.end_date = payload.end_date

    db.commit()
    db.refresh(leave)

    emp = db.query(models.Employee).filter(models.Employee.id == leave.employee_id).first()
    if emp:
        sync_employee_leave_balances(db, emp)

    return leave


def get_annual_leaves_by_gender(gender: Optional[str]) -> int:
    """Female -> 12 leaves per year; Male / Other -> 6 leaves per year."""
    if gender and gender.strip().lower() in ["female", "f"]:
        return 12
    return 6


def sync_employee_leave_balances(db: Session, employee: models.Employee):
    gender_str = str(employee.gender) if employee.gender is not None else None
    quota = get_annual_leaves_by_gender(gender_str)

    # Fetch all approved leaves for this employee
    approved_leaves = (
        db.query(models.Leave)
        .filter(
            models.Leave.employee_id == employee.id,
            models.Leave.status == models.LeaveStatusEnum.APPROVED,
        )
        .all()
    )

    # Fetch all attendance records marked as LEAVE
    attendance_leaves = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.employee_id == employee.id,
            models.Attendance.status == models.AttendanceStatusEnum.LEAVE,
        )
        .all()
    )

    # Calculate dates covered by approved system leaves
    covered_dates = set()
    for l in approved_leaves:
        current = l.start_date
        while current <= l.end_date:
            covered_dates.add(current)
            current += timedelta(days=1)

    # Calculate how many attendance LEAVE days are NOT covered by approved system leaves
    uncovered_attendance_leaves = sum(
        1 for att in attendance_leaves if att.date not in covered_dates
    )

    for lt in models.LeaveTypeEnum:
        balance = db.query(models.LeaveBalance).filter(
            models.LeaveBalance.employee_id == employee.id,
            models.LeaveBalance.leave_type == lt,
        ).first()

        used_days = sum(
            max((l.end_date - l.start_date).days + 1, 1)
            for l in approved_leaves
            if l.leave_type == lt
        )

        # Add uncovered attendance leaves to CASUAL balance as a catch-all
        if lt == models.LeaveTypeEnum.CASUAL:
            used_days += uncovered_attendance_leaves

        if balance:
            balance.total = quota
            balance.used = used_days
        else:
            balance = models.LeaveBalance(
                employee_id=employee.id,
                leave_type=lt,
                total=quota,
                used=used_days,
            )
            db.add(balance)

    db.commit()


@router.get("/balances", response_model=List[schemas.LeaveBalanceOut])
def get_all_balances(
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role.value == "EMPLOYEE" and current_user.employee:
        sync_employee_leave_balances(db, current_user.employee)
        return (
            db.query(models.LeaveBalance)
            .filter(models.LeaveBalance.employee_id == current_user.employee.id)
            .order_by(models.LeaveBalance.leave_type)
            .all()
        )
    elif employee_id:
        emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        if emp:
            sync_employee_leave_balances(db, emp)
            return (
                db.query(models.LeaveBalance)
                .filter(models.LeaveBalance.employee_id == employee_id)
                .order_by(models.LeaveBalance.leave_type)
                .all()
            )
        return []

    return db.query(models.LeaveBalance).order_by(models.LeaveBalance.employee_id, models.LeaveBalance.leave_type).all()


@router.get("/balances/summary", response_model=List[schemas.LeaveBalanceSummary])
def get_balances_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["HR", "ADMIN", "SUPER_ADMIN"])),
):
    """Return per-employee leave balance summary efficiently in batch."""
    from collections import defaultdict

    all_emps = (
        db.query(models.Employee)
        .options(joinedload(models.Employee.department))
        .all()
    )

    all_balances = db.query(models.LeaveBalance).all()
    balances_by_emp = defaultdict(list)
    for b in all_balances:
        balances_by_emp[b.employee_id].append(b)

    results = []
    for emp in all_emps:
        balances = balances_by_emp.get(emp.id, [])

        gender_str = str(emp.gender) if emp.gender is not None else None
        quota = get_annual_leaves_by_gender(gender_str)

        total_used = sum((b.used or 0) for b in balances)
        remaining = max(quota - total_used, 0)

        type_used = {}
        for b in balances:
            lt_val = b.leave_type.value if hasattr(b.leave_type, "value") else str(b.leave_type)
            type_used[lt_val] = (b.used or 0)

        branch_val = ""
        if emp.branch:
            branch_val = emp.branch.value if hasattr(emp.branch, "value") else str(emp.branch)

        dept_name = ""
        if emp.department:
            dept_name = emp.department.name if hasattr(emp.department, "name") else str(emp.department)

        results.append(schemas.LeaveBalanceSummary(
            employee_id=emp.id,
            employee_name=f"{emp.first_name} {emp.last_name}".strip(),
            employee_number=emp.employee_number or "",
            branch=branch_val,
            department=dept_name,
            designation=emp.designation or "",
            total_quota=quota,
            total_used=total_used,
            remaining=remaining,
            casual_used=type_used.get("CASUAL", 0),
            sick_used=type_used.get("SICK", 0),
            paid_used=type_used.get("PAID", 0),
            unpaid_used=type_used.get("UNPAID", 0),
            maternity_used=type_used.get("MATERNITY", 0),
            paternity_used=type_used.get("PATERNITY", 0),
            optional_used=type_used.get("OPTIONAL", 0),
        ))

    return results


@router.delete("/{leave_id}")
def delete_leave(
    leave_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    leave = db.query(models.Leave).filter(models.Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.status != "PENDING" and current_user.role.value == "EMPLOYEE":
        raise HTTPException(status_code=400, detail="Cannot cancel non-pending leave")
    emp_id = leave.employee_id
    db.delete(leave)
    db.commit()

    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if emp:
        sync_employee_leave_balances(db, emp)

    return {"detail": "Leave cancelled"}
