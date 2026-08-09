from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/audit-logs", response_model=List[schemas.AuditLogOut])
def list_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    query = db.query(models.AuditLog)
    if action:
        query = query.filter(models.AuditLog.action == action)
    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    return query.order_by(models.AuditLog.timestamp.desc()).limit(limit).all()


@router.get("", response_model=List[schemas.SystemSettingOut])
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    return db.query(models.SystemSetting).all()


@router.post("")
def update_system_setting(
    key: str,
    value: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
    if not setting:
        setting = models.SystemSetting(key=key, value=value)
        db.add(setting)
    else:
        setting.value = value
    db.commit()
    return {"key": key, "value": value}
