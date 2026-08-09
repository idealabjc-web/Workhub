from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/holidays", tags=["holidays"])


@router.get("", response_model=List[schemas.HolidayOut])
def list_holidays(
    year: Optional[int] = None,
    branch: Optional[str] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from sqlalchemy import extract
    query = db.query(models.Holiday)
    if year:
        query = query.filter(extract("year", models.Holiday.date) == year)
    if branch:
        query = query.filter(
            (models.Holiday.branch == branch) | (models.Holiday.branch == None)
        )
    if type:
        query = query.filter(models.Holiday.type == type)
    return query.order_by(models.Holiday.date).all()


@router.post("", response_model=schemas.HolidayOut)
def create_holiday(
    payload: schemas.HolidayCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    holiday = models.Holiday(
        name=payload.name,
        date=payload.date,
        type=payload.type,
        branch=payload.branch,
        description=payload.description,
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.post("/import")
def import_holidays(
    payload: schemas.ImportHolidaysRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    count = 0
    for h in payload.holidays:
        holiday = models.Holiday(
            name=h.name,
            date=h.date,
            type=h.type,
            branch=h.branch,
            description=h.description,
        )
        db.add(holiday)
        count += 1
    db.commit()
    return {"imported": count}


@router.patch("/{holiday_id}", response_model=schemas.HolidayOut)
def update_holiday(
    holiday_id: str,
    payload: schemas.HolidayCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    holiday = db.query(models.Holiday).filter(models.Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    holiday.name = payload.name
    holiday.date = payload.date
    holiday.type = payload.type
    holiday.branch = payload.branch
    holiday.description = payload.description
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/{holiday_id}")
def delete_holiday(
    holiday_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    holiday = db.query(models.Holiday).filter(models.Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(holiday)
    db.commit()
    return {"detail": "Holiday deleted"}
