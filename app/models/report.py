from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    generated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    report_name = Column(String(255), nullable=False)
    report_type = Column(String(100), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_format = Column(String(20), default="pdf", nullable=False)
    status = Column(String(50), default="Completed", nullable=False)
    download_count = Column(Integer, default=0, nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="reports", passive_deletes=True)