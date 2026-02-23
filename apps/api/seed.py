"""Seed script - サンプルデータ投入"""
import asyncio
import uuid
from datetime import time, date, timezone, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from core.config import get_settings
from core.security import hash_password
from db.base import Base
from models.tenant import Tenant
from models.user import User
from models.membership import Membership
from models.space import Space
from models.space_layout import SpaceLayout
from models.seat import Seat
from models.time_slot import TimeSlot
from models.tenant_settings import TenantSettings


async def seed():
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url)

    # テーブル作成（開発用）
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # --- Tenant ---
        tenant = Tenant(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            name="サンプル学習塾",
            slug="sample-juku",
            description="個人塾の自習室予約デモ",
        )
        session.add(tenant)

        # --- Settings ---
        tenant_settings = TenantSettings(
            tenant_id=tenant.id,
            booking_deadline_minutes=10,
            penalty_days=3,
            max_concurrent_reservations=1,
        )
        session.add(tenant_settings)

        # --- Users ---
        admin_user = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
            email="admin@example.com",
            hashed_password=hash_password("admin123"),
            display_name="管理者 太郎",
        )
        student1 = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000020"),
            email="student1@example.com",
            hashed_password=hash_password("student123"),
            display_name="生徒 花子",
        )
        student2 = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000021"),
            email="student2@example.com",
            hashed_password=hash_password("student123"),
            display_name="生徒 次郎",
        )
        session.add_all([admin_user, student1, student2])

        # --- Memberships ---
        session.add_all([
            Membership(tenant_id=tenant.id, user_id=admin_user.id, role="admin"),
            Membership(tenant_id=tenant.id, user_id=student1.id, role="student"),
            Membership(tenant_id=tenant.id, user_id=student2.id, role="student"),
        ])

        # --- Space ---
        space = Space(
            id=uuid.UUID("00000000-0000-0000-0000-000000000100"),
            tenant_id=tenant.id,
            name="自習室A",
            description="静かな環境で集中できる自習室です。全20席。",
            grid_rows=5,
            grid_cols=6,
        )
        session.add(space)

        # --- Layout & Seats ---
        # 5x6 グリッド: 座席配置
        layout_cells = []
        seats_to_add = []
        seat_labels = []

        for r in range(5):
            row_cells = []
            for c in range(6):
                if c == 3:
                    # 中央に通路
                    row_cells.append({"type": "aisle", "label": None, "seat_type": None, "is_enabled": True})
                elif r == 2 and c in (0, 1, 2):
                    # 3行目左は静か席
                    label = f"{chr(65+r)}{c+1}"
                    row_cells.append({"type": "seat", "label": label, "seat_type": "quiet", "is_enabled": True})
                    seat = Seat(
                        space_id=space.id, label=label, row=r, col=c,
                        seat_type="quiet", is_enabled=True,
                    )
                    seats_to_add.append(seat)
                elif r == 4 and c >= 4:
                    # 最後列右にコンセント席
                    label = f"{chr(65+r)}{c+1}"
                    row_cells.append({"type": "seat", "label": label, "seat_type": "outlet", "is_enabled": True})
                    seat = Seat(
                        space_id=space.id, label=label, row=r, col=c,
                        seat_type="outlet", is_enabled=True,
                    )
                    seats_to_add.append(seat)
                else:
                    label = f"{chr(65+r)}{c+1}"
                    row_cells.append({"type": "seat", "label": label, "seat_type": "normal", "is_enabled": True})
                    seat = Seat(
                        space_id=space.id, label=label, row=r, col=c,
                        seat_type="normal", is_enabled=True,
                    )
                    seats_to_add.append(seat)
            layout_cells.append(row_cells)

        layout = SpaceLayout(
            space_id=space.id,
            version=1,
            layout_json={
                "grid_rows": 5,
                "grid_cols": 6,
                "cells": layout_cells,
            },
        )
        session.add(layout)
        session.add_all(seats_to_add)

        # --- Time Slots ---
        time_slots = [
            TimeSlot(space_id=space.id, label="09:00-11:00", start_time=time(9, 0), end_time=time(11, 0), display_order=1),
            TimeSlot(space_id=space.id, label="11:00-13:00", start_time=time(11, 0), end_time=time(13, 0), display_order=2),
            TimeSlot(space_id=space.id, label="13:00-15:00", start_time=time(13, 0), end_time=time(15, 0), display_order=3),
            TimeSlot(space_id=space.id, label="15:00-17:00", start_time=time(15, 0), end_time=time(17, 0), display_order=4),
            TimeSlot(space_id=space.id, label="17:00-19:00", start_time=time(17, 0), end_time=time(19, 0), display_order=5),
            TimeSlot(space_id=space.id, label="19:00-21:00", start_time=time(19, 0), end_time=time(21, 0), display_order=6),
        ]
        session.add_all(time_slots)

        await session.commit()
        print("✅ Seed data inserted successfully!")
        print(f"  Tenant: {tenant.name} ({tenant.slug})")
        print(f"  Admin:  admin@example.com / admin123")
        print(f"  Student: student1@example.com / student123")
        print(f"  Space: {space.name} ({len(seats_to_add)} seats)")
        print(f"  Time slots: {len(time_slots)}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
