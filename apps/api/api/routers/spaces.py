from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.session import get_db
from core.deps import require_tenant_membership, require_admin
from models.tenant import Tenant
from models.space import Space
from models.time_slot import TimeSlot
from models.user import User
from schemas.space import TenantResponse, SpaceResponse, SpaceCreateRequest
from schemas.reservation import TimeSlotResponse, TimeSlotCreateRequest
from schemas.common import APIResponse

router = APIRouter(tags=["spaces"])


@router.get("/tenants/{tenant_id}/spaces", response_model=APIResponse[list[SpaceResponse]])
async def list_spaces(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    membership: tuple = Depends(require_tenant_membership),
):
    user, tid, role = membership
    result = await db.execute(
        select(Space).where(Space.tenant_id == tenant_id, Space.is_active == True).order_by(Space.name)
    )
    spaces = result.scalars().all()
    return APIResponse(data=[SpaceResponse.model_validate(s) for s in spaces])


@router.get("/spaces/{space_id}", response_model=APIResponse[SpaceResponse])
async def get_space(
    space_id: UUID,
    db: AsyncSession = Depends(get_db),
    membership: tuple = Depends(require_tenant_membership),
):
    result = await db.execute(select(Space).where(Space.id == space_id))
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="スペースが見つかりません")
    user, tenant_id, role = membership
    if space.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="アクセス権がありません")
    return APIResponse(data=SpaceResponse.model_validate(space))


@router.post("/tenants/{tenant_id}/spaces", response_model=APIResponse[SpaceResponse])
async def create_space(
    tenant_id: UUID,
    body: SpaceCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    space = Space(
        tenant_id=tenant_id,
        name=body.name,
        description=body.description,
        grid_rows=body.grid_rows,
        grid_cols=body.grid_cols,
    )
    db.add(space)
    await db.flush()
    await db.refresh(space)
    return APIResponse(data=SpaceResponse.model_validate(space))


@router.get("/spaces/{space_id}/time-slots", response_model=APIResponse[list[TimeSlotResponse]])
async def list_time_slots(
    space_id: UUID,
    db: AsyncSession = Depends(get_db),
    membership: tuple = Depends(require_tenant_membership),
):
    result = await db.execute(
        select(TimeSlot)
        .where(TimeSlot.space_id == space_id, TimeSlot.is_active == True)
        .order_by(TimeSlot.display_order)
    )
    slots = result.scalars().all()
    return APIResponse(data=[TimeSlotResponse.model_validate(s) for s in slots])


@router.post("/spaces/{space_id}/time-slots", response_model=APIResponse[TimeSlotResponse])
async def create_time_slot(
    space_id: UUID,
    body: TimeSlotCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    slot = TimeSlot(
        space_id=space_id,
        label=body.label,
        start_time=body.start_time,
        end_time=body.end_time,
        display_order=body.display_order,
    )
    db.add(slot)
    await db.flush()
    await db.refresh(slot)
    return APIResponse(data=TimeSlotResponse.model_validate(slot))
