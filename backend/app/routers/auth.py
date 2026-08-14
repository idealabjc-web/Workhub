import os
import uuid
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import create_access_token, verify_password
from app.database import get_db

from app.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "957026139388-q05hohgt3dlsmhjf3fkdvv7us94j7rhl.apps.googleusercontent.com")


from sqlalchemy import func

@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    clean_email = payload.email.strip().lower()
    clean_password = payload.password.strip()
    user = db.query(models.User).filter(func.lower(models.User.email) == clean_email).first()
    if not user or not verify_password(clean_password, user.hashed_password):
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

    # Admins and HR are always considered profile-complete
    profile_complete = getattr(user, "profile_complete", False) or user.role.value in ("SUPER_ADMIN", "HR", "MANAGER", "FINANCE")

    return schemas.TokenResponse(
        access_token=token,
        role=user.role.value,
        email=user.email,
        employee_id=employee_id,
        full_name=full_name,
        profile_complete=profile_complete,
    )


@router.post("/google", response_model=schemas.TokenResponse)
def google_login(payload: schemas.GoogleLoginRequest, db: Session = Depends(get_db)):
    """Verifies Google ID Token and logs in or registers employee."""
    try:
        # Verify ID token using Google API
        res = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.token}", timeout=10)
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Google token")
        
        info = res.json()
        email = info.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        # Check if user exists
        user = db.query(models.User).filter(models.User.email == email).first()

        if not user:
            # First time logging in with Google -> Create user with EMPLOYEE role and profile_complete=False
            user = models.User(
                id=str(uuid.uuid4()),
                email=email,
                hashed_password=f"GOOGLE_AUTH_{uuid.uuid4().hex}",
                role=models.UserRoleEnum.EMPLOYEE,
                profile_complete=False,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        token = create_access_token({"sub": user.id, "role": user.role.value})
        full_name = None
        employee_id = None

        if user.employee:
            full_name = f"{user.employee.first_name} {user.employee.last_name}"
            employee_id = user.employee.id
        elif info.get("name"):
            full_name = info.get("name")

        profile_complete = getattr(user, "profile_complete", False) or user.role.value in ("SUPER_ADMIN", "HR", "MANAGER", "FINANCE")

        return schemas.TokenResponse(
            access_token=token,
            role=user.role.value,
            email=str(user.email),
            employee_id=employee_id,
            full_name=full_name,
            profile_complete=profile_complete,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google authentication failed: {str(e)}")


@router.get("/me", response_model=schemas.TokenResponse)
def get_current_user_auth(current_user: models.User = Depends(get_current_user)):
    full_name = None
    employee_id = None
    if current_user.employee:
        full_name = f"{current_user.employee.first_name} {current_user.employee.last_name}"
        employee_id = current_user.employee.id

    profile_complete = getattr(current_user, "profile_complete", False) or current_user.role.value in ("SUPER_ADMIN", "HR", "MANAGER", "FINANCE")

    token = create_access_token({"sub": current_user.id, "role": current_user.role.value})

    return schemas.TokenResponse(
        access_token=token,
        role=current_user.role.value,
        email=str(current_user.email),
        employee_id=employee_id,
        full_name=full_name,
        profile_complete=profile_complete,
    )

