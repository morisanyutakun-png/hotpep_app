from pydantic import BaseModel
from uuid import UUID
from datetime import date, time
from schemas.common import BaseSchema, TimestampSchema


class TimeSlotResponse(TimestampSchema):
    id: UUID
    space_id: UUID
    label: str
    start_time: time
    end_time: time
    display_order: int
    is_active: bool


class TimeSlotCreateRequest(BaseModel):
    label: str
    start_time: time
    end_time: time
    display_order: int = 0


class ReservationCreateRequest(BaseModel):
    space_id: UUID
    seat_id: UUID
    time_slot_id: UUID
    date: date


class ReservationResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    space_id: UUID
    seat_id: UUID
    user_id: UUID
    time_slot_id: UUID
    date: date
    status: str
    # Joined fields
    seat_label: str | None = None
    space_name: str | None = None
    time_slot_label: str | None = None
    user_display_name: str | None = None


class SeatAvailability(BaseSchema):
    seat_id: UUID
    label: str
    row: int
    col: int
    seat_type: str
    is_enabled: bool
    status: str  # available, reserved, my_reservation, disabled


class AvailabilityResponse(BaseSchema):
    date: date
    time_slot: TimeSlotResponse | None = None
    seats: list[SeatAvailability] = []
