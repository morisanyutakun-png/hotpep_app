from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.session import get_db
from core.deps import require_tenant_membership, require_admin
from models.tenant import Tenant
from models.space import Space
from models.seat import Seat
from models.time_slot import TimeSlot
from models.space_layout import SpaceLayout
from models.user import User
from schemas.space import TenantResponse, SpaceResponse, SpaceCreateRequest, SpaceUpdateRequest
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


@router.get("/tenants/{tenant_id}/spaces/summary")
async def list_spaces_summary(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    membership: tuple = Depends(require_tenant_membership),
):
    user, tid, role = membership
    result = await db.execute(
        select(Space).where(Space.tenant_id == tenant_id, Space.is_active == True).order_by(Space.name)
    )
    spaces = result.scalars().all()

    summaries = []
    for space in spaces:
        seat_count_result = await db.execute(
            select(func.count()).select_from(Seat).where(Seat.space_id == space.id)
        )
        seat_count = seat_count_result.scalar() or 0

        slot_count_result = await db.execute(
            select(func.count()).select_from(TimeSlot).where(
                TimeSlot.space_id == space.id, TimeSlot.is_active == True
            )
        )
        slot_count = slot_count_result.scalar() or 0

        layout_result = await db.execute(
            select(SpaceLayout)
            .where(SpaceLayout.space_id == space.id)
            .order_by(SpaceLayout.version.desc())
            .limit(1)
        )
        latest_layout = layout_result.scalar_one_or_none()

        summaries.append({
            "id": str(space.id),
            "name": space.name,
            "description": space.description,
            "is_active": space.is_active,
            "grid_rows": space.grid_rows,
            "grid_cols": space.grid_cols,
            "seat_count": seat_count,
            "time_slot_count": slot_count,
            "layout_json": latest_layout.layout_json if latest_layout else None,
            "created_at": space.created_at.isoformat() if space.created_at else None,
            "updated_at": space.updated_at.isoformat() if space.updated_at else None,
        })

    return APIResponse(data=summaries)


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


@router.put("/spaces/{space_id}", response_model=APIResponse[SpaceResponse])
async def update_space(
    space_id: UUID,
    body: SpaceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    result = await db.execute(select(Space).where(Space.id == space_id))
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="スペースが見つかりません")
    user, tenant_id = admin
    if space.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="アクセス権がありません")

    if body.name is not None:
        space.name = body.name
    if body.description is not None:
        space.description = body.description

    await db.flush()
    await db.refresh(space)
    return APIResponse(data=SpaceResponse.model_validate(space))


@router.delete("/spaces/{space_id}")
async def delete_space(
    space_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    result = await db.execute(select(Space).where(Space.id == space_id))
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="スペースが見つかりません")
    user, tenant_id = admin
    if space.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="アクセス権がありません")

    space.is_active = False
    await db.flush()
    return APIResponse(data={"message": "スペースを削除しました"})


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


@router.delete("/spaces/{space_id}/time-slots/{slot_id}")
async def delete_time_slot(
    space_id: UUID,
    slot_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    result = await db.execute(
        select(TimeSlot).where(TimeSlot.id == slot_id, TimeSlot.space_id == space_id)
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="タイムスロットが見つかりません")

    slot.is_active = False
    await db.flush()
    return APIResponse(data={"message": "タイムスロットを削除しました"})
