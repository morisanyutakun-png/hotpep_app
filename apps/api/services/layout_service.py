from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from models.space import Space
from models.space_layout import SpaceLayout
from models.seat import Seat
from schemas.layout import LayoutSaveRequest


class LayoutService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_layout(self, space_id: UUID):
        """スペースの最新レイアウトと座席一覧を取得"""
        # 最新レイアウト取得
        result = await self.db.execute(
            select(SpaceLayout)
            .where(SpaceLayout.space_id == space_id)
            .order_by(SpaceLayout.version.desc())
            .limit(1)
        )
        layout = result.scalar_one_or_none()

        # 座席一覧取得
        seats_result = await self.db.execute(
            select(Seat)
            .where(Seat.space_id == space_id)
            .order_by(Seat.row, Seat.col)
        )
        seats = seats_result.scalars().all()

        # スペース情報
        space_result = await self.db.execute(
            select(Space).where(Space.id == space_id)
        )
        space = space_result.scalar_one_or_none()

        return layout, seats, space

    async def save_layout(self, space_id: UUID, data: LayoutSaveRequest):
        """レイアウトを保存（layout_json + seats テーブル更新）"""
        # スペース情報更新
        space_result = await self.db.execute(
            select(Space).where(Space.id == space_id)
        )
        space = space_result.scalar_one_or_none()
        if not space:
            raise ValueError("スペースが見つかりません")

        space.grid_rows = data.grid_rows
        space.grid_cols = data.grid_cols

        # 現在のバージョン取得
        version_result = await self.db.execute(
            select(SpaceLayout.version)
            .where(SpaceLayout.space_id == space_id)
            .order_by(SpaceLayout.version.desc())
            .limit(1)
        )
        current_version = version_result.scalar_one_or_none() or 0

        # layout_json を構築
        layout_json = {
            "grid_rows": data.grid_rows,
            "grid_cols": data.grid_cols,
            "cells": [[cell.model_dump() for cell in row] for row in data.cells],
        }

        # レイアウト保存
        new_layout = SpaceLayout(
            space_id=space_id,
            version=current_version + 1,
            layout_json=layout_json,
        )
        self.db.add(new_layout)

        # 既存座席を削除し再作成
        await self.db.execute(
            delete(Seat).where(Seat.space_id == space_id)
        )

        # セルからseatを抽出して保存
        for row_idx, row in enumerate(data.cells):
            for col_idx, cell in enumerate(row):
                if cell.type == "seat":
                    seat = Seat(
                        space_id=space_id,
                        label=cell.label or f"{chr(65 + row_idx)}{col_idx + 1}",
                        row=row_idx,
                        col=col_idx,
                        seat_type=cell.seat_type or "normal",
                        is_enabled=cell.is_enabled,
                    )
                    self.db.add(seat)

        await self.db.flush()
        await self.db.refresh(new_layout)
        return new_layout
