from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.session import get_db
from core.deps import require_tenant_membership, require_admin
from models.space import Space
from models.user import User
from services.layout_service import LayoutService
from schemas.layout import LayoutSaveRequest, LayoutResponse, SpaceLayoutWithSeats, SeatResponse
from schemas.common import APIResponse

router = APIRouter(tags=["layout"])


@router.get("/spaces/{space_id}/layout", response_model=APIResponse[SpaceLayoutWithSeats])
async def get_layout(
    space_id: UUID,
    db: AsyncSession = Depends(get_db),
    membership: tuple = Depends(require_tenant_membership),
):
    service = LayoutService(db)
    layout, seats, space = await service.get_layout(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="スペースが見つかりません")

    user, tenant_id, role = membership
    if space.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="アクセス権がありません")

    return APIResponse(
        data=SpaceLayoutWithSeats(
            layout=LayoutResponse.model_validate(layout) if layout else None,
            seats=[SeatResponse.model_validate(s) for s in seats],
            grid_rows=space.grid_rows,
            grid_cols=space.grid_cols,
        )
    )


@router.put("/spaces/{space_id}/layout", response_model=APIResponse[LayoutResponse])
async def save_layout(
    space_id: UUID,
    body: LayoutSaveRequest,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    # テナントチェック
    result = await db.execute(select(Space).where(Space.id == space_id))
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="スペースが見つかりません")
    user, tenant_id = admin
    if space.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="アクセス権がありません")

    service = LayoutService(db)
    layout = await service.save_layout(space_id, body)
    return APIResponse(data=LayoutResponse.model_validate(layout))
