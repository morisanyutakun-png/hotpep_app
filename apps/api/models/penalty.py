import uuid
from sqlalchemy import Column, String, Date, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class Penalty(Base, TimestampMixin):
    __tablename__ = "penalties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(String(50), nullable=False, default="no_show")  # no_show, manual
    detail = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    # Relationships
    user = relationship("User", back_populates="penalties")
