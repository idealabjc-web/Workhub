from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=List[schemas.DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Department).all()
