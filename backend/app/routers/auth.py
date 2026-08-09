from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import create_access_token, verify_password
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token({"sub": user.id, "role": user.role.value})
    full_name = None
    employee_id = None
    if user.employee:
        full_name = f"{user.employee.first_name} {user.employee.last_name}"
        employee_id = user.employee.id
    return schemas.TokenResponse(
        access_token=token,
        role=user.role.value,
        email=user.email,
        employee_id=employee_id,
        full_name=full_name,
    )
