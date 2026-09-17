from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ReportGenerateRequest(BaseModel):
    report_type: str
    file_format: str = "pdf"
    report_name: Optional[str] = None


class ReportCreate(BaseModel):
    generated_by: Optional[int] = None
    report_name: str
    report_type: str
    file_path: Optional[str] = None
    file_format: str = "pdf"
    status: str = "Completed"
    download_count: int = 0


class ReportResponse(BaseModel):
    id: int
    generated_by: Optional[int] = None
    generated_by_name: Optional[str] = None
    report_name: str
    report_type: str
    file_path: str
    file_format: str
    status: str
    download_count: int
    generated_at: Optional[datetime] = None

    class Config:
        from_attributes = True