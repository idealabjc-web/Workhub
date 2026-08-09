from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


@router.get("", response_model=List[schemas.ExpenseOut])
def list_expenses(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    branch: Optional[str] = None,
    category: Optional[str] = None,
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Expense)
    if current_user.role.value == "EMPLOYEE" and current_user.employee:
        query = query.filter(models.Expense.employee_id == current_user.employee.id)
    elif employee_id:
        query = query.filter(models.Expense.employee_id == employee_id)
    if status:
        query = query.filter(models.Expense.status == status)
    if branch:
        query = query.filter(models.Expense.branch == branch)
    if category:
        query = query.filter(models.Expense.category == category)
    if month:
        from sqlalchemy import extract
        year, m = map(int, month.split("-"))
        query = query.filter(
            extract("year", models.Expense.date) == year,
            extract("month", models.Expense.date) == m,
        )
    return query.order_by(models.Expense.created_at.desc()).all()


@router.post("", response_model=schemas.ExpenseOut)
def create_expense(
    payload: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = models.Expense(
        employee_id=payload.employee_id,
        branch=payload.branch,
        department_id=payload.department_id,
        category=payload.category,
        amount=payload.amount,
        date=payload.date,
        description=payload.description,
        payment_method=payload.payment_method,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.patch("/{expense_id}/status", response_model=schemas.ExpenseOut)
def update_expense_status(
    expense_id: str,
    payload: schemas.ExpenseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE", "MANAGER"])),
):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    expense.status = payload.status
    expense.approved_by = current_user.id
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}")
def delete_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.status != "PENDING":
        raise HTTPException(status_code=400, detail="Cannot delete non-pending expense")
    db.delete(expense)
    db.commit()
    return {"detail": "Expense deleted"}


@router.get("/summary/monthly")
def expense_summary(
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    from datetime import date
    from sqlalchemy import extract, func
    m_str = month or date.today().strftime("%Y-%m")
    year, m = map(int, m_str.split("-"))

    query = db.query(models.Expense).filter(
        extract("year", models.Expense.date) == year,
        extract("month", models.Expense.date) == m,
    )
    records = query.all()

    by_category: dict = {}
    for r in records:
        by_category[r.category] = by_category.get(r.category, 0) + r.amount

    return {
        "month": m_str,
        "total": sum(r.amount for r in records),
        "pending": sum(r.amount for r in records if r.status == "PENDING"),
        "approved": sum(r.amount for r in records if r.status == "APPROVED"),
        "paid": sum(r.amount for r in records if r.status == "PAID"),
        "by_category": [{"category": k, "amount": v} for k, v in by_category.items()],
    }
