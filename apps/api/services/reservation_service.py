from datetime import date, datetime, timezone, timedelta
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from models.reservation import Reservation
from models.seat import Seat
from models.time_slot import TimeSlot
from models.penalty import Penalty
from models.tenant_settings import TenantSettings
from schemas.reservation import SeatAvailability


class ReservationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_settings(self, tenant_id: UUID) -> TenantSettings | None:
        result = await self.db.execute(
            select(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def check_penalty(self, tenant_id: UUID, user_id: UUID) -> Penalty | None:
        """アクティブなペナルティがあるか確認"""
        today = date.today()
        result = await self.db.execute(
            select(Penalty).where(
                and_(
                    Penalty.tenant_id == tenant_id,
                    Penalty.user_id == user_id,
                    Penalty.start_date <= today,
                    Penalty.end_date >= today,
                )
            )
        )
        return result.scalar_one_or_none()

    async def check_duplicate_user_timeslot(
        self, user_id: UUID, target_date: date, time_slot_id: UUID
    ) -> bool:
        """同一ユーザーが同一時間帯に予約済みか確認"""
        result = await self.db.execute(
            select(func.count(Reservation.id)).where(
                and_(
                    Reservation.user_id == user_id,
                    Reservation.date == target_date,
                    Reservation.time_slot_id == time_slot_id,
                    Reservation.status.in_(["booked", "checked_in"]),
                )
            )
        )
        return result.scalar_one() > 0

    async def check_seat_availability(
        self, seat_id: UUID, target_date: date, time_slot_id: UUID
    ) -> bool:
        """指定席が空いているか確認"""
        result = await self.db.execute(
            select(func.count(Reservation.id)).where(
                and_(
                    Reservation.seat_id == seat_id,
                    Reservation.date == target_date,
                    Reservation.time_slot_id == time_slot_id,
                    Reservation.status.in_(["booked", "checked_in", "used"]),
                )
            )
        )
        return result.scalar_one() == 0

    async def check_booking_deadline(
        self, time_slot_id: UUID, target_date: date, deadline_minutes: int
    ) -> bool:
        """予約締切を超えていないか確認"""
        result = await self.db.execute(
            select(TimeSlot).where(TimeSlot.id == time_slot_id)
        )
        time_slot = result.scalar_one_or_none()
        if not time_slot:
            return False

        slot_start = datetime.combine(target_date, time_slot.start_time, tzinfo=timezone(timedelta(hours=9)))
        deadline = slot_start - timedelta(minutes=deadline_minutes)
        now = datetime.now(timezone(timedelta(hours=9)))
        return now < deadline

    async def create_reservation(
        self,
        tenant_id: UUID,
        space_id: UUID,
        seat_id: UUID,
        user_id: UUID,
        time_slot_id: UUID,
        target_date: date,
    ) -> Reservation:
        """予約を作成（全バリデーション実行）"""
        # 1. ペナルティチェック
        penalty = await self.check_penalty(tenant_id, user_id)
        if penalty:
            raise ValueError(
                f"ペナルティ期間中のため予約できません（{penalty.end_date}まで）"
            )

        # 2. 設定取得
        settings = await self.get_settings(tenant_id)
        deadline_minutes = settings.booking_deadline_minutes if settings else 10

        # 3. 締切チェック
        if not await self.check_booking_deadline(time_slot_id, target_date, deadline_minutes):
            raise ValueError("予約締切を過ぎています")

        # 4. 同一ユーザー重複チェック
        if await self.check_duplicate_user_timeslot(user_id, target_date, time_slot_id):
            raise ValueError("同じ時間帯にすでに予約があります")

        # 5. 座席空きチェック
        if not await self.check_seat_availability(seat_id, target_date, time_slot_id):
            raise ValueError("この座席はすでに予約されています")

        # 6. 座席の有効性チェック
        result = await self.db.execute(select(Seat).where(Seat.id == seat_id))
        seat = result.scalar_one_or_none()
        if not seat or not seat.is_enabled:
            raise ValueError("この座席は利用できません")

        # 7. 予約作成
        reservation = Reservation(
            tenant_id=tenant_id,
            space_id=space_id,
            seat_id=seat_id,
            user_id=user_id,
            time_slot_id=time_slot_id,
            date=target_date,
            status="booked",
        )
        self.db.add(reservation)
        await self.db.flush()
        await self.db.refresh(reservation)
        return reservation

    async def get_availability(
        self,
        space_id: UUID,
        target_date: date,
        time_slot_id: UUID,
        current_user_id: UUID | None = None,
    ) -> list[SeatAvailability]:
        """指定日時の座席空き状況を取得"""
        # 全座席取得
        seats_result = await self.db.execute(
            select(Seat).where(Seat.space_id == space_id).order_by(Seat.row, Seat.col)
        )
        seats = seats_result.scalars().all()

        # 予約状況取得
        reservations_result = await self.db.execute(
            select(Reservation).where(
                and_(
                    Reservation.space_id == space_id,
                    Reservation.date == target_date,
                    Reservation.time_slot_id == time_slot_id,
                    Reservation.status.in_(["booked", "checked_in", "used"]),
                )
            )
        )
        reservations = reservations_result.scalars().all()

        reserved_seats = {}
        for r in reservations:
            reserved_seats[r.seat_id] = r

        availability = []
        for seat in seats:
            if not seat.is_enabled:
                status = "disabled"
            elif seat.id in reserved_seats:
                r = reserved_seats[seat.id]
                if current_user_id and r.user_id == current_user_id:
                    status = "my_reservation"
                else:
                    status = "reserved"
            else:
                status = "available"

            availability.append(
                SeatAvailability(
                    seat_id=seat.id,
                    label=seat.label,
                    row=seat.row,
                    col=seat.col,
                    seat_type=seat.seat_type,
                    is_enabled=seat.is_enabled,
                    status=status,
                )
            )

        return availability

    async def cancel_reservation(self, reservation_id: UUID, user_id: UUID) -> Reservation:
        result = await self.db.execute(
            select(Reservation).where(Reservation.id == reservation_id)
        )
        reservation = result.scalar_one_or_none()
        if not reservation:
            raise ValueError("予約が見つかりません")
        if reservation.user_id != user_id:
            raise PermissionError("この予約をキャンセルする権限がありません")
        if reservation.status not in ("booked",):
            raise ValueError("この予約はキャンセルできません")
        reservation.status = "cancelled"
        await self.db.flush()
        await self.db.refresh(reservation)
        return reservation

    async def admin_check_in(self, reservation_id: UUID) -> Reservation:
        result = await self.db.execute(
            select(Reservation).where(Reservation.id == reservation_id)
        )
        reservation = result.scalar_one_or_none()
        if not reservation:
            raise ValueError("予約が見つかりません")
        if reservation.status != "booked":
            raise ValueError("チェックインできるステータスではありません")
        reservation.status = "checked_in"
        await self.db.flush()
        await self.db.refresh(reservation)
        return reservation

    async def admin_mark_used(self, reservation_id: UUID) -> Reservation:
        result = await self.db.execute(
            select(Reservation).where(Reservation.id == reservation_id)
        )
        reservation = result.scalar_one_or_none()
        if not reservation:
            raise ValueError("予約が見つかりません")
        reservation.status = "used"
        await self.db.flush()
        await self.db.refresh(reservation)
        return reservation

    async def admin_mark_no_show(
        self, reservation_id: UUID, tenant_id: UUID
    ) -> Reservation:
        result = await self.db.execute(
            select(Reservation).where(Reservation.id == reservation_id)
        )
        reservation = result.scalar_one_or_none()
        if not reservation:
            raise ValueError("予約が見つかりません")

        reservation.status = "no_show"

        # ペナルティ付与
        settings = await self.get_settings(tenant_id)
        penalty_days = settings.penalty_days if settings else 3

        today = date.today()
        penalty = Penalty(
            tenant_id=tenant_id,
            user_id=reservation.user_id,
            reason="no_show",
            detail=f"予約ID: {reservation.id} の無断欠席",
            start_date=today,
            end_date=today + timedelta(days=penalty_days),
        )
        self.db.add(penalty)
        await self.db.flush()
        await self.db.refresh(reservation)
        return reservation
