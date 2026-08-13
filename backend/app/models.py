import enum
import uuid
from datetime import date, datetime, timezone

def utc_now():
    return datetime.now(timezone.utc)
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class UserRoleEnum(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    HR = "HR"
    MANAGER = "MANAGER"
    FINANCE = "FINANCE"
    EMPLOYEE = "EMPLOYEE"


class EmploymentTypeEnum(str, enum.Enum):
    FULL_TIME = "Full-Time"
    PART_TIME = "Part-Time"
    CONTRACT = "Contract"
    INTERN = "Intern"


class EmployeeStatusEnum(str, enum.Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    ON_LEAVE = "On Leave"


class BranchEnum(str, enum.Enum):
    IDEALAB = "IDEALAB"
    UGC = "UGC"
    VIZAG = "VIZAG"
    HYD = "HYD"


class AttendanceStatusEnum(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    WFH = "WFH"
    HALF_DAY = "HALF_DAY"
    LEAVE = "LEAVE"
    HOLIDAY = "HOLIDAY"
    WEEK_OFF = "WEEK_OFF"


class LeaveTypeEnum(str, enum.Enum):
    CASUAL = "CASUAL"
    SICK = "SICK"
    PAID = "PAID"
    UNPAID = "UNPAID"
    MATERNITY = "MATERNITY"
    PATERNITY = "PATERNITY"
    OPTIONAL = "OPTIONAL"


class LeaveStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    MANAGER_APPROVED = "MANAGER_APPROVED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ExpenseStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PAID = "PAID"


class PriorityEnum(str, enum.Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


# ── Database Models ─────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRoleEnum), default=UserRoleEnum.EMPLOYEE, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    is_active = Column(Boolean, default=True)
    profile_complete = Column(Boolean, default=False)

    employee = relationship("Employee", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class Department(Base):
    __tablename__ = "departments"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    branch = Column(Enum(BranchEnum), nullable=False)

    employees = relationship("Employee", back_populates="department")
    teams = relationship("Team", back_populates="department")


class Team(Base):
    __tablename__ = "teams"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    branch = Column(Enum(BranchEnum), nullable=False)
    department_id = Column(String, ForeignKey("departments.id"), nullable=True)
    team_leader_id = Column(String, ForeignKey("employees.id"), nullable=True)

    department = relationship("Department", back_populates="teams")
    revenues = relationship("Revenue", back_populates="team")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    employee_number = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact = Column(String, nullable=True)
    date_of_joining = Column(Date, nullable=False, default=date.today)
    department_id = Column(String, ForeignKey("departments.id"), nullable=True)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    team_name = Column(String, nullable=True)
    designation = Column(String, nullable=True)
    reporting_manager_id = Column(String, ForeignKey("employees.id"), nullable=True)
    branch = Column(Enum(BranchEnum), default=BranchEnum.IDEALAB, nullable=False)
    employment_type = Column(Enum(EmploymentTypeEnum), default=EmploymentTypeEnum.FULL_TIME, nullable=False)
    status = Column(Enum(EmployeeStatusEnum), default=EmployeeStatusEnum.ACTIVE, nullable=False)
    basic_salary = Column(Float, nullable=True, default=0.0)
    profile_photo_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="employee")
    department = relationship("Department", back_populates="employees")
    reporting_manager = relationship("Employee", remote_side=[id])
    attendance_records = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    leave_requests = relationship("Leave", back_populates="employee", cascade="all, delete-orphan")
    leave_balances = relationship("LeaveBalance", back_populates="employee", cascade="all, delete-orphan")
    payrolls = relationship("Payroll", back_populates="employee", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="employee", cascade="all, delete-orphan")
    documents = relationship("EmployeeDocument", back_populates="employee", cascade="all, delete-orphan")
    moments = relationship("Moment", back_populates="employee", cascade="all, delete-orphan")
    corrections = relationship("AttendanceCorrection", back_populates="employee", cascade="all, delete-orphan")


class EmployeeDocument(Base):
    __tablename__ = "employee_documents"

    id = Column(String, primary_key=True, default=gen_uuid)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False)
    doc_type = Column(String, nullable=False)  # Resume, Aadhaar, PAN, Offer Letter, etc.
    file_url = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=utc_now)

    employee = relationship("Employee", back_populates="documents")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(String, primary_key=True, default=gen_uuid)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    check_in_lat = Column(Float, nullable=True)
    check_in_lng = Column(Float, nullable=True)
    check_out_lat = Column(Float, nullable=True)
    check_out_lng = Column(Float, nullable=True)
    status = Column(Enum(AttendanceStatusEnum), default=AttendanceStatusEnum.PRESENT, nullable=False)
    overtime_hours = Column(Float, default=0.0)
    is_late = Column(Boolean, default=False)
    is_early_logout = Column(Boolean, default=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    employee = relationship("Employee", back_populates="attendance_records")


class AttendanceCorrection(Base):
    __tablename__ = "attendance_corrections"

    id = Column(String, primary_key=True, default=gen_uuid)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    requested_status = Column(Enum(AttendanceStatusEnum), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(Enum(LeaveStatusEnum), default=LeaveStatusEnum.PENDING, nullable=False)
    reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    employee = relationship("Employee", back_populates="corrections")


class MonthlyAttendanceStatus(Base):
    __tablename__ = "monthly_attendance_status"

    id = Column(String, primary_key=True, default=gen_uuid)
    month = Column(String, nullable=False)  # YYYY-MM
    branch = Column(String, nullable=True)
    is_finalized = Column(Boolean, default=False)
    finalized_by = Column(String, ForeignKey("users.id"), nullable=True)
    finalized_at = Column(DateTime, nullable=True)


class Leave(Base):
    __tablename__ = "leaves"

    id = Column(String, primary_key=True, default=gen_uuid)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False)
    leave_type = Column(Enum(LeaveTypeEnum), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(Enum(LeaveStatusEnum), default=LeaveStatusEnum.PENDING, nullable=False)
    approved_by = Column(String, ForeignKey("users.id"), nullable=True)
    comments = Column(Text, nullable=True)
    applied_at = Column(DateTime, default=utc_now)

    employee = relationship("Employee", back_populates="leave_requests")

    @property
    def employee_name(self) -> str:
        if self.employee:
            full = f"{self.employee.first_name or ''} {self.employee.last_name or ''}".strip()
            return full if full else "Staff Member"
        return "Staff Member"

    @property
    def employee_number(self) -> str:
        if self.employee:
            return self.employee.employee_number or ""
        return ""

    @property
    def branch(self) -> str:
        if self.employee and self.employee.branch:
            return self.employee.branch.value if hasattr(self.employee.branch, "value") else str(self.employee.branch)
        return ""


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(String, primary_key=True, default=gen_uuid)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False)
    leave_type = Column(Enum(LeaveTypeEnum), nullable=False)
    total = Column(Integer, default=12)
    used = Column(Integer, default=0)

    employee = relationship("Employee", back_populates="leave_balances")


class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(String, primary_key=True, default=gen_uuid)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False)
    month = Column(String, nullable=False)  # YYYY-MM
    basic_salary = Column(Float, nullable=False, default=0.0)
    hra = Column(Float, default=0.0)
    bonus = Column(Float, default=0.0)
    incentives = Column(Float, default=0.0)
    pf = Column(Float, default=0.0)
    esi = Column(Float, default=0.0)
    professional_tax = Column(Float, default=200.0)
    income_tax = Column(Float, default=0.0)
    other_deductions = Column(Float, default=0.0)
    net_salary = Column(Float, nullable=False, default=0.0)
    status = Column(String, default="Processed")  # Draft, Processing, Processed, Paid
    paid_at = Column(DateTime, nullable=True)
    generated_at = Column(DateTime, default=utc_now)

    employee = relationship("Employee", back_populates="payrolls")
    payslips = relationship("Payslip", back_populates="payroll", cascade="all, delete-orphan")


class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(String, primary_key=True, default=gen_uuid)
    payroll_id = Column(String, ForeignKey("payrolls.id"), nullable=False)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False)
    month = Column(String, nullable=False)
    sent_to_email = Column(String, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    payroll = relationship("Payroll", back_populates="payslips")


class Revenue(Base):
    __tablename__ = "revenues"

    id = Column(String, primary_key=True, default=gen_uuid)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    branch = Column(Enum(BranchEnum), nullable=True)
    month = Column(String, nullable=False)  # YYYY-MM
    target = Column(Float, nullable=False, default=0.0)
    achieved = Column(Float, nullable=False, default=0.0)
    incentives = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    team = relationship("Team", back_populates="revenues")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True, default=gen_uuid)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False)
    branch = Column(Enum(BranchEnum), nullable=True)
    department_id = Column(String, ForeignKey("departments.id"), nullable=True)
    category = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    receipt_url = Column(String, nullable=True)
    payment_method = Column(String, default="Cash")  # Cash, Card, Bank Transfer, UPI
    status = Column(Enum(ExpenseStatusEnum), default=ExpenseStatusEnum.PENDING, nullable=False)
    approved_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    employee = relationship("Employee", back_populates="expenses")


class Moment(Base):
    __tablename__ = "moments"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=True)
    date = Column(Date, nullable=False)
    branch = Column(Enum(BranchEnum), nullable=True)
    category = Column(String, default="Achievement")  # Birthday, Anniversary, Achievement, Celebration, New Joiner, Promotion
    image_url = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    employee = relationship("Employee", back_populates="moments")


class CompanyEvent(Base):
    __tablename__ = "company_events"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    time = Column(String, nullable=True)
    location = Column(String, nullable=True)
    organizer = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    branch = Column(Enum(BranchEnum), nullable=True)
    created_at = Column(DateTime, default=utc_now)


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    date = Column(Date, nullable=False, default=date.today)
    priority = Column(Enum(PriorityEnum), default=PriorityEnum.NORMAL, nullable=False)
    branch = Column(Enum(BranchEnum), nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now)


class HRDocument(Base):
    __tablename__ = "hr_documents"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # Policy, Form, Template, Compliance, Contract
    employee_id = Column(String, ForeignKey("employees.id"), nullable=True)
    file_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    is_confidential = Column(Boolean, default=False)
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now)


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    type = Column(String, default="National")  # National, Festival, Company, Optional, Branch
    branch = Column(Enum(BranchEnum), nullable=True)
    description = Column(String, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, default="INFO")  # INFO, SUCCESS, WARNING, ERROR
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user_email = Column(String, nullable=True)
    action = Column(String, nullable=False)  # CREATE, UPDATE, DELETE, CELL_EDIT, IMPORT, FINALIZE
    entity_type = Column(String, nullable=False)  # Employee, Attendance, Payroll, Expense, Revenue, Holiday, System
    entity_id = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="audit_logs")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(String, primary_key=True, default=gen_uuid)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=datetime.utcnow)
