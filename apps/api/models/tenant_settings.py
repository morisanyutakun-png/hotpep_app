import uuid
from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from db.base import Base, TimestampMixin


class TenantSettings(Base, TimestampMixin):
    __tablename__ = "tenant_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # 予約締切（開始何分前まで予約可能）
    booking_deadline_minutes = Column(Integer, default=10, nullable=False)

    # ペナルティ日数（no_show時の予約停止日数）
    penalty_days = Column(Integer, default=3, nullable=False)

    # 最大同時予約数
    max_concurrent_reservations = Column(Integer, default=1, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="settings")
