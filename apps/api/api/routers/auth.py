from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from db.session import get_db
from core.security import verify_password, create_access_token, hash_password
from core.deps import get_current_user
from models.user import User
from models.membership import Membership
from schemas.auth import LoginRequest, RegisterRequest, RegisterResponse, TokenResponse, MeResponse, MembershipInfo, UserResponse
from schemas.common import APIResponse
from models.tenant import Tenant
from models.tenant_settings import TenantSettings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=APIResponse[RegisterResponse])
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """開発用: 認証不要のアカウント作成エンドポイント"""
    # メールアドレス重複チェック
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています",
        )

    # ユーザー作成
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # テナント決定: 指定あればそれ、なければ既存の最初のテナント、なければ自動作成
    tenant_id = None

    # tenant_idが有効なUUIDの場合のみ検索
    if body.tenant_id and body.tenant_id.strip():
        try:
            import uuid
            tid = uuid.UUID(body.tenant_id)
            result = await db.execute(select(Tenant).where(Tenant.id == tid))
            tenant = result.scalar_one_or_none()
            if tenant:
                tenant_id = tenant.id
        except (ValueError, AttributeError):
            pass  # 無効なUUIDは無視して自動割当に進む

    if not tenant_id:
        # 既存テナントを探す
        result = await db.execute(select(Tenant).where(Tenant.is_active == True).limit(1))
        tenant = result.scalar_one_or_none()
        if not tenant:
            # テナントが1つもなければ開発用テナントを自動作成
            import uuid as uuid_mod
            tenant = Tenant(
                name="開発テナント",
                slug=f"dev-tenant-{uuid_mod.uuid4().hex[:8]}",
                description="開発用に自動作成されたテナント",
                is_active=True,
            )
            db.add(tenant)
            await db.flush()
            # デフォルト設定も作成
            tenant_settings = TenantSettings(
                tenant_id=tenant.id,
                booking_deadline_minutes=10,
                penalty_days=3,
                max_concurrent_reservations=2,
            )
            db.add(tenant_settings)
        tenant_id = tenant.id

    # メンバーシップ作成（必ず作る）
    membership = Membership(
        tenant_id=tenant_id,
        user_id=user.id,
        role=body.role,
    )
    db.add(membership)

    await db.commit()

    token = create_access_token({"sub": str(user.id)})
    return APIResponse(data=RegisterResponse(
        access_token=token,
        tenant_id=str(tenant_id),
    ))


@router.get("/tenants", response_model=APIResponse[list[dict]])
async def list_tenants(db: AsyncSession = Depends(get_db)):
    """開発用: テナント一覧取得（認証不要）"""
    result = await db.execute(select(Tenant).where(Tenant.is_active == True))
    tenants = result.scalars().all()
    return APIResponse(data=[
        {"id": str(t.id), "name": t.name, "slug": t.slug}
        for t in tenants
    ])


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
