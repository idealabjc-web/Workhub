from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("", response_model=List[schemas.TeamOut])
def list_teams(
    branch: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Team)
    if branch:
        query = query.filter(models.Team.branch == branch)
    return query.all()


@router.post("", response_model=schemas.TeamOut)
def create_team(
    payload: schemas.TeamCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    team = models.Team(**payload.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.get("/departments", response_model=List[schemas.DepartmentOut])
def list_departments(
    branch: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Department)
    if branch:
        query = query.filter(models.Department.branch == branch)
    return query.all()
