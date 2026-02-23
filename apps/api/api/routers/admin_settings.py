from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from db.session import get_db
from core.deps import require_admin
from models.tenant_settings import TenantSettings
from models.user import User
from schemas.settings import TenantSettingsResponse, TenantSettingsUpdateRequest
from schemas.common import APIResponse

router = APIRouter(prefix="/admin", tags=["admin-settings"])


@router.get("/settings", response_model=APIResponse[TenantSettingsResponse])
async def get_settings(
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    user, tenant_id = admin
    result = await db.execute(
        select(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        # 存在しない場合はデフォルトを作成
        settings = TenantSettings(tenant_id=tenant_id)
        db.add(settings)
        await db.flush()
        await db.refresh(settings)
    return APIResponse(data=TenantSettingsResponse.model_validate(settings))


@router.put("/settings", response_model=APIResponse[TenantSettingsResponse])
async def update_settings(
    body: TenantSettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    user, tenant_id = admin
    result = await db.execute(
        select(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = TenantSettings(tenant_id=tenant_id)
        db.add(settings)

    if body.booking_deadline_minutes is not None:
        settings.booking_deadline_minutes = body.booking_deadline_minutes
    if body.penalty_days is not None:
        settings.penalty_days = body.penalty_days
    if body.max_concurrent_reservations is not None:
        settings.max_concurrent_reservations = body.max_concurrent_reservations

    await db.flush()
    await db.refresh(settings)
    return APIResponse(data=TenantSettingsResponse.model_validate(settings))
