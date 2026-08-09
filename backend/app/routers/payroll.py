from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/payroll", tags=["payroll"])


@router.get("", response_model=List[schemas.PayrollOut])
def list_payroll(
    employee_id: Optional[str] = None,
    month: Optional[str] = None,
    branch: Optional[str] = None,
    department_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    """Only HR/Admin/Finance can access payroll data"""
    query = db.query(models.Payroll)
    if employee_id:
        query = query.filter(models.Payroll.employee_id == employee_id)
    if month:
        query = query.filter(models.Payroll.month == month)

    if branch or department_id:
        query = query.join(models.Employee, models.Payroll.employee_id == models.Employee.id)
        if branch:
            query = query.filter(models.Employee.branch == branch)
        if department_id:
            query = query.filter(models.Employee.department_id == department_id)

    return query.order_by(models.Payroll.generated_at.desc()).all()


@router.post("/generate", response_model=schemas.PayrollOut)
def generate_payroll(
    payload: schemas.PayrollGenerateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    existing = db.query(models.Payroll).filter(
        models.Payroll.employee_id == payload.employee_id,
        models.Payroll.month == payload.month,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payroll already generated for this month")

    gross = payload.basic_salary + payload.hra + payload.bonus + payload.incentives
    deductions = payload.pf + payload.esi + payload.professional_tax + payload.income_tax + payload.other_deductions
    net = gross - deductions

    payroll = models.Payroll(
        employee_id=payload.employee_id,
        month=payload.month,
        basic_salary=payload.basic_salary,
        hra=payload.hra,
        bonus=payload.bonus,
        incentives=payload.incentives,
        pf=payload.pf,
        esi=payload.esi,
        professional_tax=payload.professional_tax,
        income_tax=payload.income_tax,
        other_deductions=payload.other_deductions,
        net_salary=round(net, 2),
        status="Processed",
    )
    db.add(payroll)
    db.flush()

    payslip = models.Payslip(
        payroll_id=payroll.id,
        employee_id=payload.employee_id,
        month=payload.month,
    )
    db.add(payslip)
    db.commit()
    db.refresh(payroll)
    return payroll


@router.post("/import")
def import_payroll(
    payload: schemas.ImportPayrollRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    count = 0
    for item in payload.payrolls:
        existing = db.query(models.Payroll).filter(
            models.Payroll.employee_id == item.employee_id,
            models.Payroll.month == item.month,
        ).first()
        if existing:
            continue
        gross = item.basic_salary + item.hra + item.bonus + item.incentives
        deductions = item.pf + item.esi + item.professional_tax + item.income_tax + item.other_deductions
        net = gross - deductions

        payroll = models.Payroll(
            employee_id=item.employee_id,
            month=item.month,
            basic_salary=item.basic_salary,
            hra=item.hra,
            bonus=item.bonus,
            incentives=item.incentives,
            pf=item.pf,
            esi=item.esi,
            professional_tax=item.professional_tax,
            income_tax=item.income_tax,
            other_deductions=item.other_deductions,
            net_salary=round(net, 2),
            status="Processed",
        )
        db.add(payroll)
        db.flush()
        db.add(models.Payslip(
            payroll_id=payroll.id,
            employee_id=item.employee_id,
            month=item.month,
        ))
        count += 1

    db.commit()
    return {"imported": count}


@router.patch("/{payroll_id}/status", response_model=schemas.PayrollOut)
def update_payroll_status(
    payroll_id: str,
    payload: schemas.PayrollStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    payroll = db.query(models.Payroll).filter(models.Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    payroll.status = payload.status
    if payload.status == "Paid":
        payroll.paid_at = datetime.utcnow()
    db.commit()
    db.refresh(payroll)
    return payroll


@router.get("/{payroll_id}", response_model=schemas.PayrollOut)
def get_payroll(
    payroll_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    payroll = db.query(models.Payroll).filter(models.Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    return payroll


@router.post("/{payroll_id}/send-payslip")
def send_payslip(
    payroll_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    payroll = db.query(models.Payroll).filter(models.Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")

    employee = db.query(models.Employee).filter(
        models.Employee.id == payroll.employee_id
    ).first()

    payslip = db.query(models.Payslip).filter(
        models.Payslip.payroll_id == payroll_id
    ).first()

    if payslip:
        payslip.sent_at = datetime.utcnow()
        payslip.sent_to_email = employee.email if employee else "unknown"
        db.commit()

    return {
        "status": "dev_mode",
        "message": f"[DEV] Payslip sent to {employee.email if employee else 'unknown'}.",
        "employee": employee.email if employee else None,
        "month": payroll.month,
    }


@router.get("/summary/monthly")
def monthly_summary(
    month: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    records = db.query(models.Payroll).filter(models.Payroll.month == month).all()
    total = sum(r.net_salary for r in records)
    return {
        "month": month,
        "total_payroll": total,
        "total_employees": len(records),
        "pending": sum(1 for r in records if r.status in ["Draft", "Processing"]),
        "paid": sum(1 for r in records if r.status == "Paid"),
        "processed": sum(1 for r in records if r.status == "Processed"),
    }
