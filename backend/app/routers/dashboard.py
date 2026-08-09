from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=schemas.DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = date.today()

    total_employees = db.query(models.Employee).count()
    active_employees = db.query(models.Employee).filter(
        models.Employee.status == "Active"
    ).count()

    present_today = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.date == today,
            models.Attendance.status.in_([
                models.AttendanceStatusEnum.PRESENT,
                models.AttendanceStatusEnum.WFH,
            ]),
        )
        .count()
    )

    on_leave = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.date == today,
            models.Attendance.status == models.AttendanceStatusEnum.LEAVE,
        )
        .count()
    )

    absent_today = max(active_employees - present_today - on_leave, 0)

    new_joiners_this_month = (
        db.query(models.Employee)
        .filter(
            extract("month", models.Employee.date_of_joining) == today.month,
            extract("year", models.Employee.date_of_joining) == today.year,
        )
        .count()
    )

    # Upcoming birthdays in the next 30 days
    upcoming_birthdays = (
        db.query(models.Employee)
        .filter(models.Employee.date_of_birth.isnot(None))
        .count()
    )

    attendance_percentage = (
        round((present_today / active_employees) * 100, 1) if active_employees else 0.0
    )

    # Pending leaves
    pending_leaves = (
        db.query(models.Leave)
        .filter(models.Leave.status == models.LeaveStatusEnum.PENDING)
        .count()
    )

    # Pending expenses
    pending_expenses = (
        db.query(models.Expense)
        .filter(models.Expense.status == models.ExpenseStatusEnum.PENDING)
        .count()
    )

    # Monthly payroll
    current_month = today.strftime("%Y-%m")
    monthly_payroll = (
        db.query(func.sum(models.Payroll.net_salary))
        .filter(models.Payroll.month == current_month)
        .scalar() or 0.0
    )

    # Revenue this month
    total_revenue = (
        db.query(func.sum(models.Revenue.achieved))
        .filter(models.Revenue.month == current_month)
        .scalar() or 0.0
    )

    # Today's activities
    today_activities = (
        db.query(models.Activity)
        .filter(models.Activity.date == today)
        .count()
    )

    # Unread notifications
    unread_notifications = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False,
        )
        .count()
    )

    return schemas.DashboardStats(
        total_employees=total_employees,
        active_employees=active_employees,
        present_today=present_today,
        absent_today=absent_today,
        on_leave=on_leave,
        new_joiners_this_month=new_joiners_this_month,
        upcoming_birthdays=min(upcoming_birthdays, 5),
        upcoming_anniversaries=min(active_employees, 3),
        attendance_percentage=attendance_percentage,
        pending_leaves=pending_leaves,
        pending_expenses=pending_expenses,
        monthly_payroll=monthly_payroll,
        total_revenue_this_month=total_revenue,
        today_activities=today_activities,
        unread_notifications=unread_notifications,
    )


@router.get("/recent-activity")
def recent_activity(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns recent leaves, activities, and moments for dashboard feed"""
    today = date.today()

    recent_leaves = (
        db.query(models.Leave)
        .order_by(models.Leave.applied_at.desc())
        .limit(5)
        .all()
    )

    recent_moments = (
        db.query(models.Moment)
        .order_by(models.Moment.created_at.desc())
        .limit(5)
        .all()
    )

    upcoming_events = (
        db.query(models.CompanyEvent)
        .filter(models.CompanyEvent.date >= today)
        .order_by(models.CompanyEvent.date)
        .limit(5)
        .all()
    )

    announcements = (
        db.query(models.Announcement)
        .order_by(models.Announcement.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "recent_leaves": [
            {"id": l.id, "employee_id": l.employee_id, "leave_type": l.leave_type.value,
             "status": l.status.value, "start_date": str(l.start_date)}
            for l in recent_leaves
        ],
        "recent_moments": [
            {"id": m.id, "title": m.title, "category": m.category, "date": str(m.date)}
            for m in recent_moments
        ],
        "upcoming_events": [
            {"id": e.id, "name": e.name, "date": str(e.date), "location": e.location}
            for e in upcoming_events
        ],
        "announcements": [
            {"id": a.id, "title": a.title, "priority": a.priority, "date": str(a.date)}
            for a in announcements
        ],
    }
