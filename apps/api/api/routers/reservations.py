from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from db.session import get_db
from core.deps import require_tenant_membership, require_admin, get_current_user
from models.reservation import Reservation
from models.seat import Seat
from models.time_slot import TimeSlot
from models.space import Space
from models.user import User
from services.reservation_service import ReservationService
from schemas.reservation import (
    ReservationCreateRequest,
    ReservationResponse,
    AvailabilityResponse,
    SeatAvailability,
    TimeSlotResponse,
)
from schemas.common import APIResponse

router = APIRouter(tags=["reservations"])


def _to_reservation_response(r: Reservation) -> ReservationResponse:
    return ReservationResponse(
        id=r.id,
        tenant_id=r.tenant_id,
        space_id=r.space_id,
        seat_id=r.seat_id,
        user_id=r.user_id,
        time_slot_id=r.time_slot_id,
        date=r.date,
        status=r.status,
        seat_label=r.seat.label if r.seat else None,
        space_name=r.space.name if r.space else None,
        time_slot_label=r.time_slot.label if r.time_slot else None,
        user_display_name=r.user.display_name if r.user else None,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@router.get("/spaces/{space_id}/availability", response_model=APIResponse[AvailabilityResponse])
async def get_availability(
    space_id: UUID,
    date: date = Query(...),
    time_slot_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    membership: tuple = Depends(require_tenant_membership),
):
    user, tenant_id, role = membership
    service = ReservationService(db)
    seats = await service.get_availability(space_id, date, time_slot_id, user.id)

    # タイムスロット情報取得
    ts_result = await db.execute(select(TimeSlot).where(TimeSlot.id == time_slot_id))
    time_slot = ts_result.scalar_one_or_none()

    return APIResponse(
        data=AvailabilityResponse(
            date=date,
            time_slot=TimeSlotResponse.model_validate(time_slot) if time_slot else None,
            seats=seats,
        )
    )


@router.post("/reservations", response_model=APIResponse[ReservationResponse])
async def create_reservation(
    body: ReservationCreateRequest,
    db: AsyncSession = Depends(get_db),
    membership: tuple = Depends(require_tenant_membership),
):
    user, tenant_id, role = membership
    service = ReservationService(db)
    try:
        reservation = await service.create_reservation(
            tenant_id=tenant_id,
            space_id=body.space_id,
            seat_id=body.seat_id,
            user_id=user.id,
            time_slot_id=body.time_slot_id,
            target_date=body.date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # リレーション読み込み
    result = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.seat),
            selectinload(Reservation.space),
            selectinload(Reservation.time_slot),
            selectinload(Reservation.user),
        )
        .where(Reservation.id == reservation.id)
    )
    reservation = result.scalar_one()
    return APIResponse(data=_to_reservation_response(reservation))


@router.get("/my/reservations", response_model=APIResponse[list[ReservationResponse]])
async def get_my_reservations(
    db: AsyncSession = Depends(get_db),
    membership: tuple = Depends(require_tenant_membership),
):
    user, tenant_id, role = membership
    result = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.seat),
            selectinload(Reservation.space),
            selectinload(Reservation.time_slot),
            selectinload(Reservation.user),
        )
        .where(
            and_(
                Reservation.user_id == user.id,
                Reservation.tenant_id == tenant_id,
            )
        )
        .order_by(Reservation.date.desc(), Reservation.created_at.desc())
    )
    reservations = result.scalars().all()
    return APIResponse(data=[_to_reservation_response(r) for r in reservations])


@router.post("/reservations/{reservation_id}/cancel", response_model=APIResponse[ReservationResponse])
async def cancel_reservation(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    membership: tuple = Depends(require_tenant_membership),
):
    user, tenant_id, role = membership
    service = ReservationService(db)
    try:
        reservation = await service.cancel_reservation(reservation_id, user.id)
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.seat),
            selectinload(Reservation.space),
            selectinload(Reservation.time_slot),
            selectinload(Reservation.user),
        )
        .where(Reservation.id == reservation.id)
    )
    reservation = result.scalar_one()
    return APIResponse(data=_to_reservation_response(reservation))


# --- Admin endpoints ---


@router.get("/admin/reservations", response_model=APIResponse[list[ReservationResponse]])
async def admin_list_reservations(
    date: date | None = Query(None),
    space_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    user, tenant_id = admin
    query = (
        select(Reservation)
        .options(
            selectinload(Reservation.seat),
            selectinload(Reservation.space),
            selectinload(Reservation.time_slot),
            selectinload(Reservation.user),
        )
        .where(Reservation.tenant_id == tenant_id)
    )
    if date:
        query = query.where(Reservation.date == date)
    if space_id:
        query = query.where(Reservation.space_id == space_id)

    query = query.order_by(Reservation.date.desc(), Reservation.created_at.desc())
    result = await db.execute(query)
    reservations = result.scalars().all()
    return APIResponse(data=[_to_reservation_response(r) for r in reservations])


@router.post("/admin/reservations/{reservation_id}/check-in", response_model=APIResponse[ReservationResponse])
async def admin_check_in(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    service = ReservationService(db)
    try:
        reservation = await service.admin_check_in(reservation_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.seat),
            selectinload(Reservation.space),
            selectinload(Reservation.time_slot),
            selectinload(Reservation.user),
        )
        .where(Reservation.id == reservation.id)
    )
    reservation = result.scalar_one()
    return APIResponse(data=_to_reservation_response(reservation))


@router.post("/admin/reservations/{reservation_id}/mark-used", response_model=APIResponse[ReservationResponse])
async def admin_mark_used(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    service = ReservationService(db)
    try:
        reservation = await service.admin_mark_used(reservation_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.seat),
            selectinload(Reservation.space),
            selectinload(Reservation.time_slot),
            selectinload(Reservation.user),
        )
        .where(Reservation.id == reservation.id)
    )
    reservation = result.scalar_one()
    return APIResponse(data=_to_reservation_response(reservation))


@router.post("/admin/reservations/{reservation_id}/mark-no-show", response_model=APIResponse[ReservationResponse])
async def admin_mark_no_show(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    user, tenant_id = admin
    service = ReservationService(db)
    try:
        reservation = await service.admin_mark_no_show(reservation_id, tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.seat),
            selectinload(Reservation.space),
            selectinload(Reservation.time_slot),
            selectinload(Reservation.user),
        )
        .where(Reservation.id == reservation.id)
    )
    reservation = result.scalar_one()
    return APIResponse(data=_to_reservation_response(reservation))
