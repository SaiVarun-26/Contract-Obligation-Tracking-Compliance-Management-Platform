from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ActivityCreate(BaseModel):
    user_id: Optional[int] = None
    contract_id: Optional[int] = None
    activity: Optional[str] = None
    action: Optional[str] = "GENERAL_ACTIVITY"
    description: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    ip_address: Optional[str] = None
    status: Optional[str] = "Success"
    metadata: Optional[Dict[str, Any]] = None


class ActivityResponse(BaseModel):
    id: int
    timestamp: datetime
    created_at: Optional[datetime] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    contract_id: Optional[int] = None
    description: str
    activity: Optional[str] = None
    ip_address: Optional[str] = None
    status: str = "Success"
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, alias="activity_metadata")

    class Config:
        from_attributes = True
        populate_by_name = True


class ActivityPaginationResponse(BaseModel):
    items: List[ActivityResponse]
    total: int
    page: int
    page_size: int
    total_pages: int