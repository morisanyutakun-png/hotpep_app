import uuid
from sqlalchemy import Column, String, Time, ForeignKey, Boolean, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class TimeSlot(Base, TimestampMixin):
    __tablename__ = "time_slots"
    __table_args__ = (
        UniqueConstraint("space_id", "label", name="uq_timeslot_space_label"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(100), nullable=False)  # e.g. "10:00-12:00"
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    space = relationship("Space", back_populates="time_slots")
    reservations = relationship("Reservation", back_populates="time_slot", lazy="selectin")
