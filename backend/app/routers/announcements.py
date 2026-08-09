from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


@router.get("", response_model=List[schemas.AnnouncementOut])
def list_announcements(
    branch: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Announcement)
    if branch:
        query = query.filter(
            (models.Announcement.branch == branch) | (models.Announcement.branch == None)
        )
    if priority:
        query = query.filter(models.Announcement.priority == priority)
    return query.order_by(models.Announcement.created_at.desc()).all()


@router.post("", response_model=schemas.AnnouncementOut)
def create_announcement(
    payload: schemas.AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    ann = models.Announcement(
        title=payload.title,
        description=payload.description,
        date=payload.date,
        priority=payload.priority,
        branch=payload.branch,
        created_by=current_user.id,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


@router.delete("/{ann_id}")
def delete_announcement(
    ann_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(ann)
    db.commit()
    return {"detail": "Announcement deleted"}
