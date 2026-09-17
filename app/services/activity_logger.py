import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.activity import Activity
from app.models.user import User

logger = logging.getLogger("contractiq.activity_logger")


class ActivityLogger:
    @staticmethod
    def get_client_ip(request: Optional[Request]) -> Optional[str]:
        if not request:
            return None
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        if request.client and request.client.host:
            return request.client.host
        return "127.0.0.1"

    @classmethod
    def log(
        cls,
        db: Session,
        action: str,
        description: str,
        user: Optional[User] = None,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
        user_role: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        contract_id: Optional[int] = None,
        status: str = "Success",
        ip_address: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None,
    ) -> Optional[Activity]:
        """
        Record a structured activity audit event in the database.
        """
        try:
            # Resolve user context
            if user:
                user_id = user.id
                user_name = user.full_name
                user_role = user.role
            elif user_id and not user_name:
                u = db.query(User).filter(User.id == user_id).first()
                if u:
                    user_name = u.full_name
                    user_role = u.role

            # Resolve IP
            if not ip_address and request:
                ip_address = cls.get_client_ip(request)
            if not ip_address:
                ip_address = "127.0.0.1"

            # Auto-link contract_id
            if not contract_id and entity_type == "Contract" and entity_id:
                contract_id = entity_id

            now = datetime.now(timezone.utc)
            meta = metadata or {}

            activity_entry = Activity(
                timestamp=now,
                created_at=now,
                user_id=user_id,
                user_name=user_name,
                user_role=user_role,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                contract_id=contract_id,
                description=description,
                activity=description,
                ip_address=ip_address,
                status=status,
                activity_metadata=meta,
            )

            db.add(activity_entry)
            db.commit()
            db.refresh(activity_entry)
            return activity_entry
        except Exception as e:
            logger.error(f"Failed to record activity log '{action}': {str(e)}", exc_info=True)
            db.rollback()
            return None
