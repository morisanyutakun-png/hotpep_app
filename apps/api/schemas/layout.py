from pydantic import BaseModel
from uuid import UUID
from typing import Any
from schemas.common import BaseSchema, TimestampSchema


class SeatResponse(TimestampSchema):
    id: UUID
    space_id: UUID
    label: str
    row: int
    col: int
    seat_type: str
    is_enabled: bool


class LayoutCellData(BaseModel):
    type: str  # seat, aisle, blocked
    label: str | None = None
    seat_type: str | None = None
    is_enabled: bool = True


class LayoutSaveRequest(BaseModel):
    grid_rows: int
    grid_cols: int
    cells: list[list[LayoutCellData]]


class LayoutResponse(TimestampSchema):
    id: UUID
    space_id: UUID
    version: int
    layout_json: Any


class SpaceLayoutWithSeats(BaseSchema):
    layout: LayoutResponse | None = None
    seats: list[SeatResponse] = []
    grid_rows: int
    grid_cols: int
