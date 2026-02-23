from uuid import UUID
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from db.session import get_db
from core.security import decode_access_token
from models.user import User
from models.membership import Membership

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なトークンです",
        )
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効なトークンです",
        )
    result = await db.execute(
        select(User)
        .options(selectinload(User.memberships).selectinload(Membership.tenant))
        .where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザーが見つかりません",
        )
    return user


async def get_current_tenant_id(
    x_tenant_id: str = Header(..., description="Current tenant ID"),
) -> UUID:
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無効なテナントIDです",
        )


async def require_tenant_membership(
    user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_current_tenant_id),
) -> tuple[User, UUID, str]:
    """Returns (user, tenant_id, role) if user is member of tenant."""
    for m in user.memberships:
        if m.tenant_id == tenant_id:
            return user, tenant_id, m.role
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="このテナントへのアクセス権がありません",
    )


async def require_admin(
    membership: tuple[User, UUID, str] = Depends(require_tenant_membership),
) -> tuple[User, UUID]:
    user, tenant_id, role = membership
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理者権限が必要です",
        )
    return user, tenant_id
