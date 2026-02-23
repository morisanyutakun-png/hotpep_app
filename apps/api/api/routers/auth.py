from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from db.session import get_db
from core.security import verify_password, create_access_token, hash_password
from core.deps import get_current_user
from models.user import User
from models.membership import Membership
from schemas.auth import LoginRequest, TokenResponse, MeResponse, MembershipInfo, UserResponse
from schemas.common import APIResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=APIResponse[TokenResponse])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .options(selectinload(User.memberships).selectinload(Membership.tenant))
        .where(User.email == body.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="アカウントが無効化されています",
        )

    token = create_access_token({"sub": str(user.id)})
    return APIResponse(data=TokenResponse(access_token=token))


@router.get("/me", response_model=APIResponse[MeResponse])
async def get_me(user: User = Depends(get_current_user)):
    memberships = []
    for m in user.memberships:
        memberships.append(
            MembershipInfo(
                id=m.id,
                tenant_id=m.tenant_id,
                role=m.role,
                tenant_name=m.tenant.name if m.tenant else None,
            )
        )

    return APIResponse(
        data=MeResponse(
            user=UserResponse(
                id=user.id,
                email=user.email,
                display_name=user.display_name,
                is_active=user.is_active,
                created_at=user.created_at,
                updated_at=user.updated_at,
            ),
            memberships=memberships,
        )
    )
