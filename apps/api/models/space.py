import uuid
from sqlalchemy import Column, String, Boolean, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class Space(Base, TimestampMixin):
    __tablename__ = "spaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    grid_rows = Column(Integer, default=8, nullable=False)
    grid_cols = Column(Integer, default=10, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="spaces")
    layouts = relationship("SpaceLayout", back_populates="space", lazy="selectin", order_by="SpaceLayout.version.desc()")
    seats = relationship("Seat", back_populates="space", lazy="selectin")
    time_slots = relationship("TimeSlot", back_populates="space", lazy="selectin")
    reservations = relationship("Reservation", back_populates="space", lazy="selectin")
