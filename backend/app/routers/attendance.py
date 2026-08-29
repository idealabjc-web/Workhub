import math
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app import models, schemas
from app.models import utc_now
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

# Default Office Locations (Branch -> {name, lat, lng, radius_meters})
OFFICE_LOCATIONS = {
    "IDEALAB": {
        "name": "Lotus Idealab Campus",
        "lat": 17.478938,
        "lng": 78.393835,
        "radius_meters": 50.0,
    },
    "UGC": {
        "name": "Lotus UGC Office",
        "lat": 17.478938,
        "lng": 78.393835,
        "radius_meters": 50.0,
    },
    "VIZAG": {
        "name": "Lotus Vizag Office",
        "lat": 17.6829765,
        "lng": 83.1828647,
        "radius_meters": 50.0,
    },
}



def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two lat/lon points."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def get_or_create_user_employee(db: Session, user: models.User) -> models.Employee:
    if user.employee:
        return user.employee

    # Look up by email
    emp = db.query(models.Employee).filter(models.Employee.email == user.email).first()
    if emp:
        emp.user_id = user.id
        db.commit()
        db.refresh(emp)
        return emp

    # Create new Employee for user
    email_name = user.email.split("@")[0]
    parts = email_name.split(".")
    fname = parts[0].capitalize()
    lname = parts[1].capitalize() if len(parts) > 1 else "Staff"

    from app.routers.employees import next_employee_number
    emp = models.Employee(
        user_id=user.id,
        employee_number=next_employee_number(db),
        first_name=fname,
        last_name=lname,
        email=user.email,
        branch=models.BranchEnum.IDEALAB,
        status=models.EmployeeStatusEnum.ACTIVE,
        employment_type=models.EmploymentTypeEnum.FULL_TIME,
        date_of_joining=date.today(),
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


def ensure_naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is not None:
        return dt.replace(tzinfo=None)
    return dt


def validate_office_location(db: Session, employee: models.Employee, user_lat: float, user_lng: float, is_checkout: bool = False):
    # Check if global remote check-in / geofence bypass is enabled
    bypass_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "allow_remote_checkin").first()
    global_remote = bypass_setting.value == "true" if bypass_setting else False

    # Check if employee is explicitly permitted for WFH
    is_wfh = getattr(employee, "is_wfh_allowed", False) if employee else False

    # Check if employee has WFH attendance status today
    today = date.today()
    today_att = db.query(models.Attendance).filter(
        models.Attendance.employee_id == employee.id,
        models.Attendance.date == today
    ).first() if employee else None
    has_wfh_today = (today_att.status == models.AttendanceStatusEnum.WFH) if today_att else False

    allow_remote = global_remote or is_wfh or has_wfh_today

    branch_val = "IDEALAB"
    if employee and employee.branch:
        branch_val = employee.branch.value if hasattr(employee.branch, "value") else str(employee.branch)
    office = dict(OFFICE_LOCATIONS.get(branch_val) or OFFICE_LOCATIONS["IDEALAB"])

    # Check for custom override in SystemSetting
    custom_setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == f"office_location_{branch_val}"
    ).first()
    if custom_setting and custom_setting.value:
        try:
            import json
            cfg = json.loads(custom_setting.value)
            office["name"] = cfg.get("name", office["name"])
            office["lat"] = float(cfg.get("lat", office["lat"]))
            office["lng"] = float(cfg.get("lng", office["lng"]))
            office["radius_meters"] = float(cfg.get("radius_meters", office["radius_meters"]))
        except Exception:
            pass

    # For check-out: if user has already checked in today or remote is allowed, bypass location check if GPS is not available (0.0, 0.0)
    if is_checkout and (allow_remote or (today_att and today_att.check_in) or (user_lat == 0.0 and user_lng == 0.0)):
        return office, 0.0

    # If remote check-in is allowed for this employee, skip distance check
    if allow_remote:
        return office, 0.0

    # If coordinates are not provided (0.0) and remote check-in is not allowed, reject
    if user_lat == 0.0 and user_lng == 0.0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Location verification required! You are an office employee and must check in from office premises. "
                "Please enable browser/device location services."
            ),
        )

    office_lat = float(office["lat"])
    office_lng = float(office["lng"])
    allowed_radius = float(office["radius_meters"])

    distance = calculate_haversine_distance(user_lat, user_lng, office_lat, office_lng)

    if distance > allowed_radius:
        dist_str = f"{distance:.0f}m" if distance < 1000 else f"{distance/1000:.2f}km"
        raise HTTPException(
            status_code=400,
            detail=(
                f"Location verification failed! You are {dist_str} away from {office['name']}. "
                f"Check-in/out is required within {allowed_radius:.0f}m of office premises for office staff."
            ),
        )

    return office, distance


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


@router.get("/today-status")
def get_today_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    emp = get_or_create_user_employee(db, current_user)
    today = date.today()
    att = db.query(models.Attendance).filter(
        models.Attendance.employee_id == emp.id,
        models.Attendance.date == today,
    ).first()

    branch_val = "IDEALAB"
    if emp and emp.branch:
        branch_val = emp.branch.value if hasattr(emp.branch, "value") else str(emp.branch)
    office = dict(OFFICE_LOCATIONS.get(branch_val) or OFFICE_LOCATIONS["IDEALAB"])

    custom_setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == f"office_location_{branch_val}"
    ).first()
    if custom_setting and custom_setting.value:
        try:
            import json
            cfg = json.loads(custom_setting.value)
            office["name"] = cfg.get("name", office["name"])
            office["lat"] = float(cfg.get("lat", office["lat"]))
            office["lng"] = float(cfg.get("lng", office["lng"]))
            office["radius_meters"] = float(cfg.get("radius_meters", office["radius_meters"]))
        except Exception:
            pass

    remote_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "allow_remote_checkin").first()
    global_remote = remote_setting.value == "true" if remote_setting else False
    is_wfh = getattr(emp, "is_wfh_allowed", False) if emp else False

    has_wfh_today = (att.status == models.AttendanceStatusEnum.WFH) if att else False
    allow_remote = global_remote or is_wfh or has_wfh_today

    return {
        "date": today.isoformat(),
        "employee_id": emp.id,
        "branch": branch_val,
        "office_location": office,
        "allow_remote_checkin": allow_remote,
        "is_wfh_allowed": is_wfh,
        "attendance": schemas.AttendanceOut.model_validate(att) if att else None,
    }


@router.post("/set-office-location")
def set_office_location(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    import json
    branch = payload.get("branch", "IDEALAB")
    lat = float(payload.get("lat", 17.4399))
    lng = float(payload.get("lng", 78.3812))
    radius = float(payload.get("radius_meters", 1000.0))
    name = payload.get("name", f"{branch} Office Premises")

    data = json.dumps({"name": name, "lat": lat, "lng": lng, "radius_meters": radius})

    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == f"office_location_{branch}").first()
    if setting:
        setting.value = data
    else:
        db.add(models.SystemSetting(key=f"office_location_{branch}", value=data))

    db.commit()
    log_audit(db, current_user, "UPDATE_OFFICE_LOCATION", branch, f"Set office location: {name} ({lat}, {lng}, r={radius}m)")
    return {"message": f"Updated office location for {branch}", "office": {"name": name, "lat": lat, "lng": lng, "radius_meters": radius}}


@router.post("/toggle-remote-checkin")
def toggle_remote_checkin(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "allow_remote_checkin").first()
    if setting:
        setting.value = "false" if setting.value == "true" else "true"
    else:
        setting = models.SystemSetting(key="allow_remote_checkin", value="true")
        db.add(setting)

    db.commit()
    log_audit(db, current_user, "TOGGLE_REMOTE_CHECKIN", "System", f"Set allow_remote_checkin to {setting.value}")
    return {"allow_remote_checkin": setting.value == "true"}


def ensure_sunday_week_offs(db: Session, year: int, month: int, employee_id: Optional[str] = None):
    """Ensure all Sundays in the specified month have a WEEK_OFF attendance record if not checked in."""
    import calendar
    try:
        days_in_month = calendar.monthrange(year, month)[1]
    except Exception:
        return

    emp_query = db.query(models.Employee).filter(models.Employee.status == "Active")
    if employee_id:
        emp_query = emp_query.filter(models.Employee.id == employee_id)
    employees = emp_query.all()

    sundays = [date(year, month, day) for day in range(1, days_in_month + 1) if date(year, month, day).weekday() == 6]
    if not sundays or not employees:
        return

    added = False
    for emp in employees:
        for sunday_date in sundays:
            existing = db.query(models.Attendance).filter(
                models.Attendance.employee_id == emp.id,
                models.Attendance.date == sunday_date,
            ).first()
            if not existing:
                db.add(models.Attendance(
                    employee_id=emp.id,
                    date=sunday_date,
                    status=models.AttendanceStatusEnum.WEEK_OFF,
                ))
                added = True
            elif existing.check_in is None and existing.status != models.AttendanceStatusEnum.WEEK_OFF:
                existing.status = models.AttendanceStatusEnum.WEEK_OFF
                added = True

    if added:
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
    if month:
        try:
            year, m = map(int, month.split("-"))
            target_emp_id = current_user.employee.id if current_user.role.value == "EMPLOYEE" and current_user.employee else employee_id
            ensure_sunday_week_offs(db, year, m, target_emp_id)
        except Exception:
            pass

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

    records = query.order_by(models.Attendance.date.desc()).all()
    for r in records:
        if r.employee:
            r.employee_name = f"{r.employee.first_name} {r.employee.last_name}".strip()
            r.employee_number = r.employee.employee_number
            r.branch = r.employee.branch.value if hasattr(r.employee.branch, "value") else str(r.employee.branch)
    return records


@router.delete("/{id}")
def delete_attendance_record(
    id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    att = db.query(models.Attendance).filter(models.Attendance.id == id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    month_str = att.date.strftime("%Y-%m")
    fin = db.query(models.MonthlyAttendanceStatus).filter(
        models.MonthlyAttendanceStatus.month == month_str,
        models.MonthlyAttendanceStatus.is_finalized == True,
    ).first()
    if fin:
        raise HTTPException(status_code=400, detail=f"Attendance for {month_str} is finalized and locked")

    db.delete(att)
    db.commit()
    log_audit(db, current_user, "DELETE_ATTENDANCE", id, f"Deleted attendance record for date {att.date}, emp {att.employee_id}")
    return {"message": "Attendance record deleted successfully"}


@router.patch("/cell")
def update_attendance_cell(
    payload: schemas.AttendanceCellUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    """Pagara Manual Grid Cell Entry by HR/Admin"""
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

    # Clear / Undo mistaken cell entry
    if not payload.status or payload.status.upper() in ["CLEAR", "RESET", "UNSET", "NONE"]:
        if existing:
            db.delete(existing)
            db.commit()
            log_audit(db, current_user, "CELL_CLEAR", existing.id, f"Cleared attendance for Date: {payload.date}, Emp: {payload.employee_id}")
        return {
            "id": existing.id if existing else "cleared",
            "employee_id": payload.employee_id,
            "date": payload.date,
            "status": "",
            "overtime_hours": 0.0,
            "is_late": False,
            "is_early_logout": False,
        }

    status_enum = models.AttendanceStatusEnum(payload.status)

    if existing:
        old_status = existing.status.value if hasattr(existing.status, "value") else existing.status
        existing.status = status_enum
        db.commit()
        db.refresh(existing)
        log_audit(db, current_user, "CELL_EDIT", str(existing.id), f"Date: {payload.date}, Emp: {payload.employee_id}, {old_status} -> {payload.status}")
        return existing

    att = models.Attendance(
        employee_id=payload.employee_id,
        date=payload.date,
        status=status_enum,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    log_audit(db, current_user, "CELL_EDIT", str(att.id), f"Date: {payload.date}, Emp: {payload.employee_id}, Status set to {payload.status}")
    return att


@router.post("/check-in", response_model=schemas.AttendanceOut)
def check_in(
    payload: schemas.AttendanceCheckIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    emp = get_or_create_user_employee(db, current_user)
    today = date.today()
    existing = db.query(models.Attendance).filter(
        models.Attendance.employee_id == emp.id,
        models.Attendance.date == today,
    ).first()
    if existing and existing.check_in:
        raise HTTPException(status_code=400, detail="Already checked in today")

    user_lat = payload.latitude if payload.latitude is not None else 0.0
    user_lng = payload.longitude if payload.longitude is not None else 0.0

    # Validate office location geofence
    office, dist = validate_office_location(db, emp, user_lat, user_lng)

    now = datetime.now()
    is_late = now.hour > 9 or (now.hour == 9 and now.minute > 30)

    if existing:
        existing.check_in = now
        existing.check_in_lat = user_lat
        existing.check_in_lng = user_lng
        existing.status = models.AttendanceStatusEnum.PRESENT
        existing.is_late = is_late
        if payload.notes:
            existing.notes = payload.notes
        att = existing
    else:
        att = models.Attendance(
            employee_id=emp.id,
            date=today,
            check_in=now,
            check_in_lat=user_lat,
            check_in_lng=user_lng,
            status=models.AttendanceStatusEnum.PRESENT,
            is_late=is_late,
            notes=payload.notes,
        )
        db.add(att)

    db.commit()
    db.refresh(att)
    log_audit(db, current_user, "CHECK_IN", str(att.id), f"Checked in at {office['name']} ({dist:.0f}m away)")
    return att


@router.post("/check-out", response_model=schemas.AttendanceOut)
def check_out(
    payload: schemas.AttendanceCheckOut,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    emp = get_or_create_user_employee(db, current_user)
    today = date.today()
    att = db.query(models.Attendance).filter(
        models.Attendance.employee_id == emp.id,
        models.Attendance.date == today,
    ).first()
    if not att or not att.check_in:
        raise HTTPException(status_code=404, detail="No active check-in record found for today")

    if att.check_out:
        raise HTTPException(status_code=400, detail="Already checked out today")

    user_lat = payload.latitude if payload.latitude is not None else 0.0
    user_lng = payload.longitude if payload.longitude is not None else 0.0

    # Validate office location geofence for check-out
    office, dist = validate_office_location(db, emp, user_lat, user_lng, is_checkout=True)

    now = datetime.now()
    cin = ensure_naive(att.check_in)

    att.check_out = now
    att.check_out_lat = user_lat
    att.check_out_lng = user_lng

    if cin:
        hours = max(0.0, (now - cin).total_seconds() / 3600.0)
        if hours > 9:
            att.overtime_hours = round(hours - 9, 2)
        else:
            att.overtime_hours = 0.0
        att.is_early_logout = hours < 8
    else:
        hours = 0.0

    db.commit()
    db.refresh(att)
    log_audit(db, current_user, "CHECK_OUT", att.id, f"Checked out at {office['name']} ({dist:.0f}m away), Work Hours: {hours:.2f}h")
    return att


@router.patch("/{id}/time", response_model=schemas.AttendanceOut)
def edit_attendance_time(
    id: str,
    payload: schemas.AttendanceTimeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    """Endpoint to manually update an employee's check-in / check-out times and status."""
    att = db.query(models.Attendance).filter(models.Attendance.id == id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    rec_date = att.date

    def parse_time_input(val: str, ref_date: date) -> Optional[datetime]:
        if not val or not val.strip():
            return None
        val_str = val.strip()
        if ":" in val_str and not ("T" in val_str or "-" in val_str):
            parts = val_str.split(":")
            h, m = int(parts[0]), int(parts[1])
            s = int(parts[2]) if len(parts) > 2 else 0
            return datetime.combine(ref_date, datetime.min.time().replace(hour=h, minute=m, second=s))
        try:
            val_clean = val_str.replace("Z", "")
            if "+" in val_clean:
                val_clean = val_clean.split("+")[0]
            dt = datetime.fromisoformat(val_clean)
            return dt.replace(tzinfo=None)
        except Exception:
            return None

    if payload.check_in is not None:
        if payload.check_in == "" or payload.check_in == "CLEAR":
            att.check_in = None
            att.is_late = False
        else:
            new_cin = parse_time_input(payload.check_in, rec_date)
            if new_cin:
                att.check_in = new_cin
                att.is_late = new_cin.hour > 9 or (new_cin.hour == 9 and new_cin.minute > 30)

    if payload.check_out is not None:
        if payload.check_out == "" or payload.check_out == "CLEAR":
            att.check_out = None
            att.overtime_hours = 0.0
            att.is_early_logout = False
        else:
            new_cout = parse_time_input(payload.check_out, rec_date)
            if new_cout:
                att.check_out = new_cout

    if att.check_in and att.check_out:
        cin = ensure_naive(att.check_in)
        cout = ensure_naive(att.check_out)
        hours = max(0.0, (cout - cin).total_seconds() / 3600.0) if (cin and cout) else 0.0
        if hours > 9:
            att.overtime_hours = round(hours - 9, 2)
        else:
            att.overtime_hours = 0.0
        att.is_early_logout = hours < 8

    if payload.status:
        try:
            att.status = models.AttendanceStatusEnum(payload.status)
        except Exception:
            pass

    if payload.notes is not None:
        att.notes = payload.notes

    db.commit()
    db.refresh(att)
    log_audit(db, current_user, "EDIT_ATTENDANCE_TIME", str(att.id), f"HR updated timestamps for Emp {att.employee_id} on {att.date}")
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
    ensure_sunday_week_offs(db, year, m)

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
        fin.finalized_at = utc_now()

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
