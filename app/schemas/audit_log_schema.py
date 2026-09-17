from typing import Optional
from pydantic import BaseModel


class AuditLogCreate(BaseModel):
    user_id: Optional[int] = None
    action: str
    table_name: str
    record_id: Optional[int] = None


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    table_name: str
    record_id: Optional[int] = None

    class Config:
        from_attributes = True