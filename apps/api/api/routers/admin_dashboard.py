from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from db.session import get_db
from core.deps import require_admin
from models.reservation import Reservation
from models.seat import Seat
from models.space import Space
from models.user import User
from schemas.common import APIResponse, BaseSchema

router = APIRouter(prefix="/admin", tags=["admin-dashboard"])


class DashboardStats(BaseSchema):
    total_reservations_today: int = 0
    checked_in_count: int = 0
    no_show_count: int = 0
    available_seats: int = 0
    total_seats: int = 0


@router.get("/dashboard", response_model=APIResponse[DashboardStats])
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    user, tenant_id = admin
    today = date.today()

    # 今日の予約数
    total_result = await db.execute(
        select(func.count(Reservation.id)).where(
            and_(
                Reservation.tenant_id == tenant_id,
                Reservation.date == today,
                Reservation.status.in_(["booked", "checked_in", "used"]),
            )
        )
    )
    total_reservations = total_result.scalar_one()

    # チェックイン済み
    checkin_result = await db.execute(
        select(func.count(Reservation.id)).where(
            and_(
                Reservation.tenant_id == tenant_id,
                Reservation.date == today,
                Reservation.status.in_(["checked_in", "used"]),
            )
        )
    )
    checked_in = checkin_result.scalar_one()

    # no_show
    noshow_result = await db.execute(
        select(func.count(Reservation.id)).where(
            and_(
                Reservation.tenant_id == tenant_id,
                Reservation.date == today,
                Reservation.status == "no_show",
            )
        )
    )
    no_show = noshow_result.scalar_one()

    # 総座席数（テナント全スペース）
    seats_result = await db.execute(
        select(func.count(Seat.id))
        .join(Space, Seat.space_id == Space.id)
        .where(and_(Space.tenant_id == tenant_id, Seat.is_enabled == True))
    )
    total_seats = seats_result.scalar_one()

    return APIResponse(
        data=DashboardStats(
            total_reservations_today=total_reservations,
            checked_in_count=checked_in,
            no_show_count=no_show,
            available_seats=total_seats - total_reservations,
            total_seats=total_seats,
        )
    )
