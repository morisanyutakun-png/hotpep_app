import uuid
from sqlalchemy import Column, String, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class Reservation(Base, TimestampMixin):
    __tablename__ = "reservations"
    __table_args__ = (
        # 同じ席・同じ日・同じ時間帯の重複予約防止
        UniqueConstraint(
            "seat_id", "date", "time_slot_id",
            name="uq_reservation_seat_date_timeslot",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    space_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_id = Column(UUID(as_uuid=True), ForeignKey("seats.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    time_slot_id = Column(UUID(as_uuid=True), ForeignKey("time_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="booked")  # booked, cancelled, checked_in, used, no_show

    # Relationships
    space = relationship("Space", back_populates="reservations")
    seat = relationship("Seat", back_populates="reservations")
    user = relationship("User", back_populates="reservations")
    time_slot = relationship("TimeSlot", back_populates="reservations")
