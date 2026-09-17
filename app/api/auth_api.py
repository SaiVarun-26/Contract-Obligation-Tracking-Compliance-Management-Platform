from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.role_checker import normalize_role
from app.database.database import get_db
from app.models.user import User
from app.schemas.auth_schema import Token
from app.services.activity_logger import ActivityLogger
from app.utils.security import create_access_token, verify_password

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # OAuth2 calls this field username, but ContractIQ authenticates by email.
    email = form_data.username.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    try:
        password_matches = verify_password(form_data.password, user.password)
    except (ValueError, TypeError):
        password_matches = False

    if not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    normalized_role = normalize_role(user.role)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "email": user.email,
            "role": normalized_role,
            "user_id": user.id,
        }
    )

    # Automatically record USER_LOGIN activity
    ActivityLogger.log(
        db=db,
        action="USER_LOGIN",
        description=f"User {user.email} logged in successfully",
        user=user,
        entity_type="User",
        entity_id=user.id,
        request=request,
        metadata={"email": user.email, "role": normalized_role},
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/logout")
def logout(
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Log user logout event and confirm session invalidation.
    """
    ActivityLogger.log(
        db=db,
        action="USER_LOGOUT",
        description=f"User {current_user.email} logged out",
        user=current_user,
        entity_type="User",
        entity_id=current_user.id,
        request=request,
    )
    return {"detail": "Successfully logged out"}
