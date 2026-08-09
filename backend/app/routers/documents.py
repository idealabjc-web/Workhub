from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("", response_model=List[schemas.HRDocumentOut])
def list_documents(
    category: Optional[str] = None,
    employee_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.HRDocument)

    # Employees cannot see confidential docs
    if current_user.role.value == "EMPLOYEE":
        query = query.filter(models.HRDocument.is_confidential == False)

    if category:
        query = query.filter(models.HRDocument.category == category)
    if employee_id:
        query = query.filter(models.HRDocument.employee_id == employee_id)
    if search:
        like = f"%{search}%"
        query = query.filter(models.HRDocument.name.ilike(like))

    return query.order_by(models.HRDocument.created_at.desc()).all()


@router.post("", response_model=schemas.HRDocumentOut)
def create_document(
    payload: schemas.HRDocumentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    doc = models.HRDocument(
        name=payload.name,
        category=payload.category,
        employee_id=payload.employee_id,
        description=payload.description,
        is_confidential=payload.is_confidential,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{doc_id}")
def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["SUPER_ADMIN", "HR"])),
):
    doc = db.query(models.HRDocument).filter(models.HRDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"detail": "Document deleted"}
