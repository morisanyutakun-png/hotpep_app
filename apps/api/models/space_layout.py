import uuid
from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class SpaceLayout(Base, TimestampMixin):
    __tablename__ = "space_layouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    layout_json = Column(JSONB, nullable=False)

    # Relationships
    space = relationship("Space", back_populates="layouts")
