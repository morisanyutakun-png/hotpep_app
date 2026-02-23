from pydantic import BaseModel
from uuid import UUID
from schemas.common import BaseSchema, TimestampSchema


class TenantResponse(TimestampSchema):
    id: UUID
    name: str
    slug: str
    description: str | None = None
    is_active: bool


class SpaceResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    name: str
    description: str | None = None
    is_active: bool
    grid_rows: int
    grid_cols: int


class SpaceCreateRequest(BaseModel):
    name: str
    description: str | None = None
    grid_rows: int = 8
    grid_cols: int = 10
