from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/revenue", tags=["revenue"])


@router.get("", response_model=List[schemas.RevenueOut])
def list_revenue(
    month: Optional[str] = None,
    branch: Optional[str] = None,
    team_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE", "MANAGER"])),
):
    query = db.query(models.Revenue)
    if month:
        query = query.filter(models.Revenue.month == month)
    if branch:
        query = query.filter(models.Revenue.branch == branch)
    if team_id:
        query = query.filter(models.Revenue.team_id == team_id)
    return query.order_by(models.Revenue.month.desc()).all()


@router.post("", response_model=schemas.RevenueOut)
def create_revenue(
    payload: schemas.RevenueCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE", "MANAGER"])),
):
    rev = models.Revenue(**payload.model_dump())
    db.add(rev)
    db.commit()
    db.refresh(rev)
    return rev


@router.post("/import")
def import_revenue(
    payload: schemas.ImportRevenueRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    count = 0
    for item in payload.revenues:
        rev = models.Revenue(**item.model_dump())
        db.add(rev)
        count += 1
    db.commit()
    return {"imported": count}


@router.patch("/{revenue_id}", response_model=schemas.RevenueOut)
def update_revenue(
    revenue_id: str,
    payload: schemas.RevenueUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE", "MANAGER"])),
):
    rev = db.query(models.Revenue).filter(models.Revenue.id == revenue_id).first()
    if not rev:
        raise HTTPException(status_code=404, detail="Revenue record not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rev, field, value)
    db.commit()
    db.refresh(rev)
    return rev


@router.delete("/{revenue_id}")
def delete_revenue(
    revenue_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE"])),
):
    rev = db.query(models.Revenue).filter(models.Revenue.id == revenue_id).first()
    if not rev:
        raise HTTPException(status_code=404, detail="Revenue record not found")
    db.delete(rev)
    db.commit()
    return {"detail": "Revenue record deleted"}


@router.get("/summary/monthly")
def revenue_summary(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "FINANCE", "MANAGER"])),
):
    from datetime import date
    y = year or date.today().year
    records = db.query(models.Revenue).filter(
        models.Revenue.month.like(f"{y}-%")
    ).all()

    by_month: dict = {}
    for r in records:
        m = r.month
        if m not in by_month:
            by_month[m] = {"month": m, "target": 0, "achieved": 0, "incentives": 0}
        by_month[m]["target"] += r.target
        by_month[m]["achieved"] += r.achieved
        by_month[m]["incentives"] += r.incentives

    months = sorted(by_month.values(), key=lambda x: x["month"])
    total_target = sum(r.target for r in records)
    total_achieved = sum(r.achieved for r in records)

    return {
        "year": y,
        "total_target": total_target,
        "total_achieved": total_achieved,
        "achievement_pct": round(total_achieved / total_target * 100, 1) if total_target else 0,
        "monthly": months,
    }
