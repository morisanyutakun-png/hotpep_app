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
from schemas.common import APIResponse, BaseSchema

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


# --- Timeline endpoint ---


class TimelineSeatInfo(BaseSchema):
    id: UUID
    label: str
    seat_type: str
    is_enabled: bool


class TimelineSlotInfo(BaseSchema):
    id: UUID
    label: str
    start_time: str
    end_time: str
    display_order: int


class TimelineCellReservation(BaseSchema):
    id: UUID
    status: str
    user_display_name: str | None = None
    user_id: UUID | None = None


class TimelineCell(BaseSchema):
    seat_id: UUID
    time_slot_id: UUID
    reservation: TimelineCellReservation | None = None


class TimelineSpaceInfo(BaseSchema):
    id: UUID
    name: str


class TimelineResponse(BaseSchema):
    spaces: list[TimelineSpaceInfo] = []
    seats: list[TimelineSeatInfo] = []
    time_slots: list[TimelineSlotInfo] = []
    cells: list[TimelineCell] = []
    date: date


@router.get("/admin/reservations/timeline", response_model=APIResponse[TimelineResponse])
async def admin_timeline(
    date: date = Query(...),
    space_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    """タイムライン形式で予約状況を取得（横: 座席、縦: 時間帯）"""
    user, tenant_id = admin

    # テナントのスペース一覧
    space_query = select(Space).where(
        Space.tenant_id == tenant_id,
        Space.is_active == True,
    )
    if space_id:
        space_query = space_query.where(Space.id == space_id)
    space_result = await db.execute(space_query.order_by(Space.name))
    spaces = space_result.scalars().all()

    if not spaces:
        return APIResponse(data=TimelineResponse(
            spaces=[], seats=[], time_slots=[], cells=[], date=date,
        ))

    space_ids = [s.id for s in spaces]

    # 座席取得（有効なもの）
    seat_result = await db.execute(
        select(Seat)
        .where(Seat.space_id.in_(space_ids), Seat.is_enabled == True)
        .order_by(Seat.label)
    )
    seats = seat_result.scalars().all()

    # タイムスロット取得
    ts_result = await db.execute(
        select(TimeSlot)
        .where(TimeSlot.space_id.in_(space_ids), TimeSlot.is_active == True)
        .order_by(TimeSlot.display_order, TimeSlot.start_time)
    )
    time_slots = ts_result.scalars().all()

    # 予約取得（当日、対象スペース、キャンセル以外）
    res_result = await db.execute(
        select(Reservation)
        .options(selectinload(Reservation.user))
        .where(
            Reservation.tenant_id == tenant_id,
            Reservation.date == date,
            Reservation.space_id.in_(space_ids),
            Reservation.status.in_(["booked", "checked_in", "used", "no_show"]),
        )
    )
    reservations = res_result.scalars().all()

    # 予約をseat_id + time_slot_idでマッピング
    res_map: dict[tuple, Reservation] = {}
    for r in reservations:
        res_map[(r.seat_id, r.time_slot_id)] = r

    # セルを組み立て
    cells = []
    for seat in seats:
        for ts in time_slots:
            if ts.space_id != seat.space_id:
                continue
            r = res_map.get((seat.id, ts.id))
            cell = TimelineCell(
                seat_id=seat.id,
                time_slot_id=ts.id,
                reservation=TimelineCellReservation(
                    id=r.id,
                    status=r.status,
                    user_display_name=r.user.display_name if r.user else None,
                    user_id=r.user_id,
                ) if r else None,
            )
            cells.append(cell)

    return APIResponse(data=TimelineResponse(
        spaces=[TimelineSpaceInfo(id=s.id, name=s.name) for s in spaces],
        seats=[TimelineSeatInfo(
            id=s.id, label=s.label, seat_type=s.seat_type, is_enabled=s.is_enabled,
        ) for s in seats],
        time_slots=[TimelineSlotInfo(
            id=ts.id,
            label=ts.label,
            start_time=ts.start_time.strftime("%H:%M"),
            end_time=ts.end_time.strftime("%H:%M"),
            display_order=ts.display_order,
        ) for ts in time_slots],
        cells=cells,
        date=date,
    ))
