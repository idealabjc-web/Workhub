from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app import models
from app.auth import decode_access_token
from app.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return role_checker


LEAVE_APPROVER_USER_ID = "9cea7aa5-cf22-4c8f-9f62-558b11ab27c5"
LEAVE_APPROVER_EMP_ID = "eeb58c93-cdb7-4030-9f5e-7210bf43d68f"
LEAVE_APPROVER_EMP_NUM = "SA1002"
LEAVE_APPROVER_EMAILS = {"superadmin@idealab.com", "dr.prasadkovvuru@gmail.com"}


def is_leave_approver_user(user: models.User) -> bool:
    """Checks if the user is Dr Prasad Kovvuru (CEO, #SA1002), the sole authorized leave approver."""
    if not user:
        return False

    if user.id == LEAVE_APPROVER_USER_ID:
        return True

    user_email = (user.email or "").strip().lower()
    if user_email in LEAVE_APPROVER_EMAILS:
        return True

    if user.employee:
        emp = user.employee
        if emp.id == LEAVE_APPROVER_EMP_ID:
            return True
        if (emp.employee_number or "").strip().upper() == LEAVE_APPROVER_EMP_NUM:
            return True
        emp_email = (emp.email or "").strip().lower()
        if emp_email in LEAVE_APPROVER_EMAILS:
            return True
        if (emp.designation or "").strip().upper() == "CEO":
            return True

    return False


def require_leave_approver():
    def approver_checker(current_user: models.User = Depends(get_current_user)):
        if not is_leave_approver_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the designated executive (Dr Prasad Kovvuru) is authorized to approve or reject employee leave requests.",
            )
        return current_user

    return approver_checker

