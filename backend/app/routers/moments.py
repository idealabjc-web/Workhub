from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/moments", tags=["moments"])


@router.get("", response_model=List[schemas.MomentOut])
def list_moments(
    branch: Optional[str] = None,
    category: Optional[str] = None,
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Moment)
    if branch:
        query = query.filter(models.Moment.branch == branch)
    if category:
        query = query.filter(models.Moment.category == category)
    if employee_id:
        query = query.filter(models.Moment.employee_id == employee_id)
    return query.order_by(models.Moment.date.desc()).all()


@router.post("", response_model=schemas.MomentOut)
def create_moment(
    payload: schemas.MomentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR", "MANAGER"])),
):
    moment = models.Moment(
        title=payload.title,
        description=payload.description,
        employee_id=payload.employee_id,
        date=payload.date,
        branch=payload.branch,
        category=payload.category,
        created_by=current_user.id,
    )
    db.add(moment)
    db.commit()
    db.refresh(moment)
    return moment


@router.delete("/{moment_id}")
def delete_moment(
    moment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    moment = db.query(models.Moment).filter(models.Moment.id == moment_id).first()
    if not moment:
        raise HTTPException(status_code=404, detail="Moment not found")
    db.delete(moment)
    db.commit()
    return {"detail": "Moment deleted"}


@router.get("/upcoming")
def upcoming_moments(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from datetime import date, timedelta
    today = date.today()
    end = today + timedelta(days=days)
    moments = db.query(models.Moment).filter(
        models.Moment.date >= today,
        models.Moment.date <= end,
    ).order_by(models.Moment.date).limit(10).all()
    return moments
