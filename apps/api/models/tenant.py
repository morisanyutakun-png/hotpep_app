import uuid
from sqlalchemy import Column, String, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    memberships = relationship("Membership", back_populates="tenant", lazy="selectin")
    spaces = relationship("Space", back_populates="tenant", lazy="selectin")
    settings = relationship("TenantSettings", back_populates="tenant", uselist=False, lazy="selectin")
