from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=List[schemas.CompanyEventOut])
def list_events(
    branch: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.CompanyEvent)
    if branch:
        query = query.filter(
            (models.CompanyEvent.branch == branch) | (models.CompanyEvent.branch == None)
        )
    return query.order_by(models.CompanyEvent.date.desc()).all()


@router.post("", response_model=schemas.CompanyEventOut)
def create_event(
    payload: schemas.CompanyEventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    event = models.CompanyEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.patch("/{event_id}", response_model=schemas.CompanyEventOut)
def update_event(
    event_id: str,
    payload: schemas.CompanyEventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    event = db.query(models.CompanyEvent).filter(models.CompanyEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in payload.model_dump().items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}")
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    event = db.query(models.CompanyEvent).filter(models.CompanyEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"detail": "Event deleted"}
