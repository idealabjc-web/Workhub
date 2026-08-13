import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, EmailStr, Field, field_serializer


# ── Auth & Users ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    employee_id: Optional[str] = None
    full_name: Optional[str] = None
    profile_complete: bool = True


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    full_name: Optional[str] = None
    employee_id: Optional[str] = None

    class Config:
        from_attributes = True


class OnboardingRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    profile_photo_url: Optional[str] = None
    branch: str
    employment_type: str = "Full-Time"
    designation: Optional[str] = None
    gender: Optional[str] = None
    team_name: Optional[str] = None
    date_of_joining: Optional[str] = None
    date_of_birth: Optional[str] = None


# ── Department & Team ─────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    branch: str


class DepartmentOut(BaseModel):
    id: str
    name: str
    branch: str

    class Config:
        from_attributes = True


class TeamCreate(BaseModel):
    name: str
    branch: str
    department_id: Optional[str] = None
    team_leader_id: Optional[str] = None


class TeamOut(BaseModel):
    id: str
    name: str
    branch: str
    department_id: Optional[str] = None
    team_leader_id: Optional[str] = None

    class Config:
        from_attributes = True


# ── Employee ──────────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    blood_group: Optional[str] = None
    date_of_birth: Optional[datetime.date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    designation: Optional[str] = None
    reporting_manager_id: Optional[str] = None
    branch: str = "IDEALAB"
    employment_type: str = "Full-Time"
    basic_salary: Optional[float] = 0.0
    role: str = "EMPLOYEE"


class EmployeeUpdate(BaseModel):
    employee_number: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    blood_group: Optional[str] = None
    date_of_birth: Optional[datetime.date] = None
    date_of_joining: Optional[datetime.date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    designation: Optional[str] = None
    reporting_manager_id: Optional[str] = None
    branch: Optional[str] = None
    employment_type: Optional[str] = None
    status: Optional[str] = None
    basic_salary: Optional[float] = None


class EmployeeOut(BaseModel):
    id: str
    user_id: str
    employee_number: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    blood_group: Optional[str] = None
    date_of_birth: Optional[datetime.date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    date_of_joining: datetime.date
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    designation: Optional[str] = None
    reporting_manager_id: Optional[str] = None
    branch: str
    employment_type: str
    status: str
    basic_salary: Optional[float] = None
    profile_photo_url: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class EmployeeDocumentCreate(BaseModel):
    employee_id: str
    doc_type: str
    file_name: Optional[str] = None
    file_url: Optional[str] = None


class EmployeeDocumentOut(BaseModel):
    id: str
    employee_id: str
    doc_type: str
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    uploaded_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceCheckIn(BaseModel):
    employee_id: Optional[str] = None
    latitude: Optional[float] = 0.0
    longitude: Optional[float] = 0.0
    notes: Optional[str] = None


class AttendanceCheckOut(BaseModel):
    employee_id: Optional[str] = None
    latitude: Optional[float] = 0.0
    longitude: Optional[float] = 0.0


class AttendanceCreate(BaseModel):
    employee_id: str
    date: datetime.date
    status: str = "PRESENT"
    check_in: Optional[datetime.datetime] = None
    check_out: Optional[datetime.datetime] = None
    notes: Optional[str] = None


class AttendanceCellUpdate(BaseModel):
    employee_id: str
    date: datetime.date
    status: str


class AttendanceOut(BaseModel):
    id: str
    employee_id: str
    date: datetime.date
    check_in: Optional[datetime.datetime] = None
    check_out: Optional[datetime.datetime] = None
    check_in_lat: Optional[float] = None
    check_in_lng: Optional[float] = None
    check_out_lat: Optional[float] = None
    check_out_lng: Optional[float] = None
    status: str
    overtime_hours: float
    is_late: bool
    is_early_logout: bool
    notes: Optional[str] = None
    employee_name: Optional[str] = None
    employee_number: Optional[str] = None
    branch: Optional[str] = None

    @field_serializer("check_in", "check_out", mode="plain")
    def serialize_utc_datetime(self, dt: Optional[datetime.datetime]) -> Optional[str]:
        if dt is None:
            return None
        iso = dt.isoformat()
        if not iso.endswith("Z") and "+" not in iso:
            iso += "Z"
        return iso

    class Config:
        from_attributes = True


class AttendanceCorrectionCreate(BaseModel):
    employee_id: str
    date: datetime.date
    requested_status: str
    reason: str


class AttendanceCorrectionOut(BaseModel):
    id: str
    employee_id: str
    date: datetime.date
    requested_status: str
    reason: str
    status: str
    reviewed_by: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Leave ─────────────────────────────────────────────────────────────────────

class LeaveCreate(BaseModel):
    employee_id: str
    leave_type: str
    start_date: datetime.date
    end_date: datetime.date
    reason: Optional[str] = None


class LeaveStatusUpdate(BaseModel):
    status: str
    comments: Optional[str] = None


class LeaveOut(BaseModel):
    id: str
    employee_id: str
    leave_type: str
    start_date: datetime.date
    end_date: datetime.date
    reason: Optional[str] = None
    status: str
    approved_by: Optional[str] = None
    comments: Optional[str] = None
    applied_at: datetime.datetime

    class Config:
        from_attributes = True


class LeaveBalanceOut(BaseModel):
    id: str
    employee_id: str
    leave_type: str
    total: int
    used: int

    class Config:
        from_attributes = True


# ── Payroll & Payslip ─────────────────────────────────────────────────────────

class PayrollGenerateRequest(BaseModel):
    employee_id: str
    month: str
    basic_salary: float
    hra: float = 0.0
    bonus: float = 0.0
    incentives: float = 0.0
    pf: float = 0.0
    esi: float = 0.0
    professional_tax: float = 200.0
    income_tax: float = 0.0
    other_deductions: float = 0.0


class PayrollStatusUpdate(BaseModel):
    status: str


class PayrollOut(BaseModel):
    id: str
    employee_id: str
    month: str
    basic_salary: float
    hra: float
    bonus: float
    incentives: float
    pf: float
    esi: float
    professional_tax: float
    income_tax: float
    other_deductions: float
    net_salary: float
    status: str
    paid_at: Optional[datetime.datetime] = None
    generated_at: datetime.datetime

    class Config:
        from_attributes = True


class PayslipOut(BaseModel):
    id: str
    payroll_id: str
    employee_id: str
    month: str
    sent_to_email: Optional[str] = None
    sent_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Revenue ───────────────────────────────────────────────────────────────────

class RevenueCreate(BaseModel):
    team_id: Optional[str] = None
    branch: Optional[str] = None
    month: str
    target: float
    achieved: float
    incentives: float = 0.0
    notes: Optional[str] = None


class RevenueUpdate(BaseModel):
    target: Optional[float] = None
    achieved: Optional[float] = None
    incentives: Optional[float] = None
    notes: Optional[str] = None


class RevenueOut(BaseModel):
    id: str
    team_id: Optional[str] = None
    branch: Optional[str] = None
    month: str
    target: float
    achieved: float
    incentives: float
    notes: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Expense ───────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    employee_id: str
    branch: Optional[str] = None
    department_id: Optional[str] = None
    category: str
    amount: float
    date: datetime.date
    description: Optional[str] = None
    payment_method: str = "Cash"


class ExpenseStatusUpdate(BaseModel):
    status: str


class ExpenseOut(BaseModel):
    id: str
    employee_id: str
    branch: Optional[str] = None
    department_id: Optional[str] = None
    category: str
    amount: float
    date: datetime.date
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    payment_method: str
    status: str
    approved_by: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Moment ────────────────────────────────────────────────────────────────────

class MomentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    employee_id: Optional[str] = None
    date: datetime.date
    branch: Optional[str] = None
    category: str = "Achievement"
    image_url: Optional[str] = None


class MomentOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    employee_id: Optional[str] = None
    date: datetime.date
    branch: Optional[str] = None
    category: str
    image_url: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Event, Announcement, Document, Holiday ────────────────────────────────────

class CompanyEventCreate(BaseModel):
    name: str
    date: datetime.date
    time: Optional[str] = None
    location: Optional[str] = None
    organizer: Optional[str] = None
    description: Optional[str] = None
    branch: Optional[str] = None


class CompanyEventOut(BaseModel):
    id: str
    name: str
    date: datetime.date
    time: Optional[str] = None
    location: Optional[str] = None
    organizer: Optional[str] = None
    description: Optional[str] = None
    branch: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class AnnouncementCreate(BaseModel):
    title: str
    description: str
    date: datetime.date = Field(default_factory=datetime.date.today)
    priority: str = "NORMAL"
    branch: Optional[str] = None


class AnnouncementOut(BaseModel):
    id: str
    title: str
    description: str
    date: datetime.date
    priority: str
    branch: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class HRDocumentCreate(BaseModel):
    name: str
    category: str
    employee_id: Optional[str] = None
    description: Optional[str] = None
    is_confidential: bool = False


class HRDocumentOut(BaseModel):
    id: str
    name: str
    category: str
    employee_id: Optional[str] = None
    file_url: Optional[str] = None
    description: Optional[str] = None
    is_confidential: bool
    uploaded_by: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class HolidayCreate(BaseModel):
    name: str
    date: datetime.date
    type: str = "National"
    branch: Optional[str] = None
    description: Optional[str] = None


class HolidayOut(BaseModel):
    id: str
    name: str
    date: datetime.date
    type: str
    branch: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime.datetime

    class Config:
        from_attributes = True


class SystemSettingOut(BaseModel):
    id: str
    key: str
    value: Optional[str] = None
    updated_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Bulk Import Schemas ───────────────────────────────────────────────────────

class ImportEmployeesRequest(BaseModel):
    employees: List[EmployeeCreate]


class ImportAttendanceRequest(BaseModel):
    records: List[AttendanceCreate]


class ImportPayrollRequest(BaseModel):
    payrolls: List[PayrollGenerateRequest]


class ImportRevenueRequest(BaseModel):
    revenues: List[RevenueCreate]


class ImportHolidaysRequest(BaseModel):
    holidays: List[HolidayCreate]


# ── Dashboard Stats ───────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    present_today: int
    absent_today: int
    on_leave: int
    new_joiners_this_month: int
    upcoming_birthdays: int
    upcoming_anniversaries: int
    attendance_percentage: float
    pending_leaves: int
    pending_expenses: int
    monthly_payroll: float
    total_revenue_this_month: float
    today_activities: int = 0
    unread_notifications: int
