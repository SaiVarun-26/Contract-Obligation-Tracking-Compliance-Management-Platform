from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.models.activity import Activity
from app.models.audit_log import AuditLog
from app.models.contract import Contract
from app.models.notification import Notification
from app.models.obligation import Obligation
from app.models.report import Report
from app.schemas.user_schema import UserCreate, UserResponse, UserUpdate, UserAssignee
from app.utils.security import hash_password
from app.core.auth import get_current_user
from app.core.role_checker import require_role, normalize_role
from app.services.activity_logger import ActivityLogger

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def create_user(
    user_data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin")),
):
    hashed_password = hash_password(user_data.password or "Default123!")

    user = User(
        full_name=user_data.full_name,
        email=user_data.email,
        password=hashed_password,
        role=normalize_role(user_data.role) or "Viewer",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    ActivityLogger.log(
        db=db,
        action="CREATE_USER",
        description=f"Created user '{user.full_name}' ({user.email}) with role '{user.role}'",
        user=current_user,
        entity_type="User",
        entity_id=user.id,
        request=request,
        metadata={"email": user.email, "role": user.role},
    )

    return user


@router.get(
    "/assignees",
    response_model=list[UserAssignee],
    status_code=status.HTTP_200_OK
)
def get_assignees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow all authenticated users to retrieve assignees for contract and obligation dropdowns."""
    users = db.query(User).filter(User.is_active == True).all()
    return [
        UserAssignee(
            id=u.id,
            full_name=u.full_name,
            role=normalize_role(u.role),
        )
        for u in users
    ]


@router.get(
    "/",
    response_model=list[UserResponse],
    status_code=status.HTTP_200_OK
)
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin")),
):
    users = db.query(User).all()
    return users


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Allowed: Admin or self
    if normalize_role(current_user.role) != "Admin" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to perform this action.",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return user


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK
)
def update_user(
    user_id: int,
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_admin = normalize_role(current_user.role) == "Admin"
    if not is_admin and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to perform this action.",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = user_data.model_dump(exclude_unset=True, exclude_none=True)
    if not is_admin:
        # Prevent self privilege escalation
        update_data.pop("role", None)
        update_data.pop("is_active", None)

    role_changed = False
    if "role" in update_data:
        new_role = normalize_role(update_data["role"])
        if new_role != user.role:
            role_changed = True
        update_data["role"] = new_role

    if "password" in update_data:
        user.password = hash_password(update_data.pop("password"))

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    action_label = "ROLE_CHANGE" if role_changed else "UPDATE_USER"
    ActivityLogger.log(
        db=db,
        action=action_label,
        description=f"Updated user profile for '{user.full_name}' ({user.email})",
        user=current_user,
        entity_type="User",
        entity_id=user.id,
        request=request,
        metadata={"role": user.role, "updated_keys": list(update_data.keys())},
    )

    return user


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_200_OK,
)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Admin")),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user_name = user.full_name
    user_email = user.email

    # Null out dependent foreign keys so DB won't block the delete
    db.query(Activity).filter(Activity.user_id == user_id).update({Activity.user_id: None}, synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.user_id == user_id).update({AuditLog.user_id: None}, synchronize_session=False)
    db.query(Contract).filter(Contract.created_by == user_id).update({Contract.created_by: None}, synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user_id).update({Notification.user_id: None}, synchronize_session=False)
    db.query(Obligation).filter(Obligation.assigned_to == user_id).update({Obligation.assigned_to: None}, synchronize_session=False)
    db.query(Report).filter(Report.generated_by == user_id).update({Report.generated_by: None}, synchronize_session=False)

    db.delete(user)
    db.commit()

    ActivityLogger.log(
        db=db,
        action="DELETE_USER",
        description=f"Deleted user '{user_name}' ({user_email})",
        user=current_user,
        entity_type="User",
        entity_id=user_id,
        request=request,
        metadata={"email": user_email},
    )

    return {"message": "User deleted successfully"}