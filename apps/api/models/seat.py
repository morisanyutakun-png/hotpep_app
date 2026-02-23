import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class Seat(Base, TimestampMixin):
    __tablename__ = "seats"
    __table_args__ = (
        UniqueConstraint("space_id", "row", "col", name="uq_seat_space_position"),
        UniqueConstraint("space_id", "label", name="uq_seat_space_label"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(20), nullable=False)  # e.g., A1, A2, B1
    row = Column(Integer, nullable=False)
    col = Column(Integer, nullable=False)
    seat_type = Column(String(50), nullable=False, default="normal")  # normal, quiet, outlet
    is_enabled = Column(Boolean, default=True, nullable=False)

    # Relationships
    space = relationship("Space", back_populates="seats")
    reservations = relationship("Reservation", back_populates="seat", lazy="selectin")
