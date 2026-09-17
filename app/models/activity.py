from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, Text, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_name = Column(String(100), nullable=True)
    user_role = Column(String(50), nullable=True)
    
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(Integer, nullable=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)
    
    description = Column(Text, nullable=False)
    activity = Column(String(500), nullable=True)  # Backward-compatibility alias
    
    ip_address = Column(String(50), nullable=True)
    status = Column(String(50), default="Success", nullable=False)
    activity_metadata = Column("metadata", JSON, nullable=True, default=dict)

    user = relationship("User", back_populates="activities", passive_deletes=True)
    contract = relationship("Contract", back_populates="activities")

    __table_args__ = (
        Index("ix_activities_timestamp_desc", timestamp.desc()),
        Index("ix_activities_user_id", user_id),
        Index("ix_activities_action", action),
    )