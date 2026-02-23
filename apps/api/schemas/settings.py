from pydantic import BaseModel
from uuid import UUID
from schemas.common import BaseSchema, TimestampSchema


class TenantSettingsResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    booking_deadline_minutes: int
    penalty_days: int
    max_concurrent_reservations: int


class TenantSettingsUpdateRequest(BaseModel):
    booking_deadline_minutes: int | None = None
    penalty_days: int | None = None
    max_concurrent_reservations: int | None = None
