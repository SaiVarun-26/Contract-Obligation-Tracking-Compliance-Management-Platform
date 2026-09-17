from typing import Iterable, Callable
from fastapi import Depends, HTTPException, status

from app.core.auth import get_current_user
from app.models.user import User

CANONICAL_ROLES = {
    "Admin",
    "Legal Manager",
    "Contract Manager",
    "Compliance Officer",
    "Viewer",
}

ROLE_ALIASES = {
    "admin": "Admin",
    "administrator": "Admin",
    "legal": "Legal Manager",
    "legal manager": "Legal Manager",
    "compliance": "Compliance Officer",
    "compliance officer": "Compliance Officer",
    "procurement": "Contract Manager",
    "procurement officer": "Contract Manager",
    "contract manager": "Contract Manager",
    "viewer": "Viewer",
    "employee": "Viewer",
    "department head": "Viewer",
}


def normalize_role(role: str | None) -> str:
    if not role:
        return ""
    cleaned = role.strip().lower()
    return ROLE_ALIASES.get(cleaned, role.strip())


class RoleChecker:
    def __init__(self, allowed_roles: Iterable[str]):
        self.allowed_roles = {normalize_role(r) for r in allowed_roles}

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        user_role = normalize_role(current_user.role)
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to perform this action.",
            )
        return current_user


def require_role(role: str) -> Callable[[User], User]:
    """Dependency that ensures the current user has the exact specified role."""
    return RoleChecker([role])


def require_any_role(*roles: str) -> Callable[[User], User]:
    """Dependency that ensures the current user has at least one of the specified roles."""
    return RoleChecker(roles)
