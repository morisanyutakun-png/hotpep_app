import uuid
from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    memberships = relationship("Membership", back_populates="user", lazy="selectin")
    reservations = relationship("Reservation", back_populates="user", lazy="selectin")
    penalties = relationship("Penalty", back_populates="user", lazy="selectin")
