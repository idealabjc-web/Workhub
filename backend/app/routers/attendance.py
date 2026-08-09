from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def log_audit(db: Session, user: models.User, action: str, entity_id: str, details: str):
    log = models.AuditLog(
        user_id=user.id,
        user_email=user.email,
        action=action,
        entity_type="Attendance",
        entity_id=entity_id,
        details=details,
    )
    db.add(log)
    db.commit()


@router.get("", response_model=List[schemas.AttendanceOut])
def list_attendance(
    employee_id: Optional[str] = None,
    branch: Optional[str] = None,
    department_id: Optional[str] = None,
    month: Optional[str] = None,  # YYYY-MM
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Attendance)

    # Employees can ONLY see their own records
    if current_user.role.value == "EMPLOYEE":
        if current_user.employee:
            query = query.filter(models.Attendance.employee_id == current_user.employee.id)
        else:
            return []
    elif employee_id:
        query = query.filter(models.Attendance.employee_id == employee_id)

    if month:
        year, m = map(int, month.split("-"))
        query = query.filter(
            extract("year", models.Attendance.date) == year,
            extract("month", models.Attendance.date) == m,
        )
    if start_date:
        query = query.filter(models.Attendance.date >= start_date)
    if end_date:
        query = query.filter(models.Attendance.date <= end_date)

    if branch or department_id:
        query = query.join(models.Employee, models.Attendance.employee_id == models.Employee.id)
        if branch:
            query = query.filter(models.Employee.branch == branch)
        if department_id:
            query = query.filter(models.Employee.department_id == department_id)

    return query.order_by(models.Attendance.date.desc()).all()


@router.patch("/cell", response_model=schemas.AttendanceOut)
def update_attendance_cell(
    payload: schemas.AttendanceCellUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    """Pagara Manual Grid Cell Entry by HR/Admin"""
    # Check if month is finalized
    month_str = payload.date.strftime("%Y-%m")
    fin = db.query(models.MonthlyAttendanceStatus).filter(
        models.MonthlyAttendanceStatus.month == month_str,
        models.MonthlyAttendanceStatus.is_finalized == True,
    ).first()
    if fin:
        raise HTTPException(status_code=400, detail=f"Attendance for {month_str} is finalized and locked")

    existing = db.query(models.Attendance).filter(
        models.Attendance.employee_id == payload.employee_id,
        models.Attendance.date == payload.date,
    ).first()

    status_enum = models.AttendanceStatusEnum(payload.status)

    if existing:
        old_status = existing.status.value if hasattr(existing.status, "value") else existing.status
        existing.status = status_enum
        db.commit()
        db.refresh(existing)
        log_audit(db, current_user, "CELL_EDIT", existing.id, f"Date: {payload.date}, Emp: {payload.employee_id}, {old_status} -> {payload.status}")
        return existing

    att = models.Attendance(
        employee_id=payload.employee_id,
        date=payload.date,
        status=status_enum,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    log_audit(db, current_user, "CELL_EDIT", att.id, f"Date: {payload.date}, Emp: {payload.employee_id}, Status set to {payload.status}")
    return att


@router.post("/check-in", response_model=schemas.AttendanceOut)
def check_in(
    payload: schemas.AttendanceCheckIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = date.today()
    existing = db.query(models.Attendance).filter(
        models.Attendance.employee_id == payload.employee_id,
        models.Attendance.date == today,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already checked in today")

    now = datetime.utcnow()
    is_late = now.hour > 9 or (now.hour == 9 and now.minute > 30)
    att = models.Attendance(
        employee_id=payload.employee_id,
        date=today,
        check_in=now,
        status=models.AttendanceStatusEnum.PRESENT,
        is_late=is_late,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.post("/check-out/{employee_id}", response_model=schemas.AttendanceOut)
def check_out(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = date.today()
    att = db.query(models.Attendance).filter(
        models.Attendance.employee_id == employee_id,
        models.Attendance.date == today,
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="No check-in found for today")

    now = datetime.utcnow()
    att.check_out = now
    if att.check_in:
        hours = (now - att.check_in).seconds / 3600
        if hours > 9:
            att.overtime_hours = round(hours - 9, 2)
        att.is_early_logout = hours < 8
    db.commit()
    db.refresh(att)
    return att


@router.get("/monthly-summary")
def monthly_summary(
    month: str,  # YYYY-MM
    branch: Optional[str] = None,
    department_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    """Monthly spreadsheet grid data for HR Pagara manual entry"""
    year, m = map(int, month.split("-"))

    emp_query = db.query(models.Employee).filter(models.Employee.status == "Active")
    if branch:
        emp_query = emp_query.filter(models.Employee.branch == branch)
    if department_id:
        emp_query = emp_query.filter(models.Employee.department_id == department_id)

    employees = emp_query.all()

    att_records = (
        db.query(models.Attendance)
        .filter(
            extract("year", models.Attendance.date) == year,
            extract("month", models.Attendance.date) == m,
        )
        .all()
    )

    att_map: dict = {}
    for att in att_records:
        key = (att.employee_id, att.date.day)
        att_map[key] = att.status.value if hasattr(att.status, "value") else att.status

    import calendar
    days_in_month = calendar.monthrange(year, m)[1]

    # Check finalization status
    fin = db.query(models.MonthlyAttendanceStatus).filter(
        models.MonthlyAttendanceStatus.month == month,
        models.MonthlyAttendanceStatus.branch == (branch or None),
    ).first()

    result = []
    for emp in employees:
        row = {
            "employee_id": emp.id,
            "employee_number": emp.employee_number,
            "name": f"{emp.first_name} {emp.last_name}",
            "branch": emp.branch.value if hasattr(emp.branch, "value") else emp.branch,
            "days": {},
        }
        present = absent = leave = wfh = half_day = holiday = week_off = 0
        for day in range(1, days_in_month + 1):
            status = att_map.get((emp.id, day), "")
            row["days"][day] = status
            if status == "PRESENT":
                present += 1
            elif status == "ABSENT":
                absent += 1
            elif status == "LEAVE":
                leave += 1
            elif status == "WFH":
                wfh += 1
            elif status == "HALF_DAY":
                half_day += 1
            elif status == "HOLIDAY":
                holiday += 1
            elif status == "WEEK_OFF":
                week_off += 1

        row["present"] = present
        row["absent"] = absent
        row["leave"] = leave
        row["wfh"] = wfh
        row["half_day"] = half_day
        row["holiday"] = holiday
        row["week_off"] = week_off
        working_days = max(days_in_month - holiday - week_off, 1)
        row["attendance_pct"] = round(((present + wfh + (half_day * 0.5)) / working_days) * 100, 1)
        result.append(row)

    return {
        "month": month,
        "days_in_month": days_in_month,
        "is_finalized": fin.is_finalized if fin else False,
        "employees": result,
    }


@router.post("/finalize")
def finalize_month(
    month: str,
    branch: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    fin = db.query(models.MonthlyAttendanceStatus).filter(
        models.MonthlyAttendanceStatus.month == month,
        models.MonthlyAttendanceStatus.branch == (branch or None),
    ).first()
    if not fin:
        fin = models.MonthlyAttendanceStatus(
            month=month,
            branch=branch or None,
            is_finalized=True,
            finalized_by=current_user.id,
            finalized_at=datetime.utcnow(),
        )
        db.add(fin)
    else:
        fin.is_finalized = not fin.is_finalized
        fin.finalized_by = current_user.id
        fin.finalized_at = datetime.utcnow()

    db.commit()
    log_audit(db, current_user, "FINALIZE", month, f"Attendance finalized: {fin.is_finalized} for {month}")
    return {"month": month, "is_finalized": fin.is_finalized}


# ── Attendance Corrections ───────────────────────────────────────────────────

@router.get("/corrections", response_model=List[schemas.AttendanceCorrectionOut])
def list_corrections(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.AttendanceCorrection)
    if current_user.role.value == "EMPLOYEE":
        if current_user.employee:
            query = query.filter(models.AttendanceCorrection.employee_id == current_user.employee.id)
        else:
            return []
    elif employee_id:
        query = query.filter(models.AttendanceCorrection.employee_id == employee_id)

    if status:
        query = query.filter(models.AttendanceCorrection.status == status)

    return query.order_by(models.AttendanceCorrection.created_at.desc()).all()


@router.post("/corrections", response_model=schemas.AttendanceCorrectionOut)
def request_correction(
    payload: schemas.AttendanceCorrectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    corr = models.AttendanceCorrection(
        employee_id=payload.employee_id,
        date=payload.date,
        requested_status=models.AttendanceStatusEnum(payload.requested_status),
        reason=payload.reason,
    )
    db.add(corr)
    db.commit()
    db.refresh(corr)
    return corr


@router.patch("/corrections/{corr_id}", response_model=schemas.AttendanceCorrectionOut)
def review_correction(
    corr_id: str,
    status: str,  # APPROVED or REJECTED
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    corr = db.query(models.AttendanceCorrection).filter(models.AttendanceCorrection.id == corr_id).first()
    if not corr:
        raise HTTPException(status_code=404, detail="Correction request not found")

    corr.status = models.LeaveStatusEnum(status)
    corr.reviewed_by = current_user.id

    if status == "APPROVED":
        # Apply to attendance record
        att = db.query(models.Attendance).filter(
            models.Attendance.employee_id == corr.employee_id,
            models.Attendance.date == corr.date,
        ).first()
        if att:
            att.status = corr.requested_status
        else:
            att = models.Attendance(
                employee_id=corr.employee_id,
                date=corr.date,
                status=corr.requested_status,
            )
            db.add(att)

    db.commit()
    db.refresh(corr)
    log_audit(db, current_user, "CORRECTION_REVIEW", corr.id, f"Correction {status} for date {corr.date}")
    return corr


# ── Bulk Import ───────────────────────────────────────────────────────────────

@router.post("/import")
def import_attendance(
    payload: schemas.ImportAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    count = 0
    for rec in payload.records:
        existing = db.query(models.Attendance).filter(
            models.Attendance.employee_id == rec.employee_id,
            models.Attendance.date == rec.date,
        ).first()
        if existing:
            existing.status = models.AttendanceStatusEnum(rec.status)
        else:
            db.add(models.Attendance(
                employee_id=rec.employee_id,
                date=rec.date,
                status=models.AttendanceStatusEnum(rec.status),
            ))
        count += 1
    db.commit()
    log_audit(db, current_user, "IMPORT", "Attendance", f"Bulk imported {count} attendance records")
    return {"imported": count}
