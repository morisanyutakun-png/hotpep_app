from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from db.session import get_db
from core.deps import require_admin
from core.security import hash_password, verify_password, create_access_token
from models.user import User
from models.membership import Membership
from schemas.common import APIResponse, BaseSchema

router = APIRouter(prefix="/admin", tags=["admin-students"])


# --- Schemas ---

class StudentCreateRequest(BaseSchema):
    email: str
    password: str
    display_name: str


class StudentResponse(BaseSchema):
    id: UUID
    email: str
    display_name: str
    is_active: bool
    role: str


class StudentLoginRequest(BaseSchema):
    email: str
    password: str


class StudentLoginResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    student: StudentResponse


class StudentUpdateRequest(BaseSchema):
    display_name: str | None = None
    is_active: bool | None = None
    password: str | None = None


# --- Endpoints ---

@router.get("/students", response_model=APIResponse[list[StudentResponse]])
async def list_students(
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    """テナントに所属する生徒一覧を取得"""
    user, tenant_id = admin
    result = await db.execute(
        select(Membership)
        .options(selectinload(Membership.user))
        .where(
            Membership.tenant_id == tenant_id,
            Membership.role == "student",
        )
    )
    memberships = result.scalars().all()
    students = [
        StudentResponse(
            id=m.user.id,
            email=m.user.email,
            display_name=m.user.display_name,
            is_active=m.user.is_active,
            role=m.role,
        )
        for m in memberships
        if m.user
    ]
    return APIResponse(data=students)


@router.post("/students", response_model=APIResponse[StudentResponse])
async def create_student(
    body: StudentCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    """管理者が生徒アカウントを作成"""
    user, tenant_id = admin

    # メールアドレス重複チェック
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています",
        )

    # ユーザー作成
    new_user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    # テナントのメンバーシップ作成（生徒として）
    membership = Membership(
        tenant_id=tenant_id,
        user_id=new_user.id,
        role="student",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(new_user)

    return APIResponse(data=StudentResponse(
        id=new_user.id,
        email=new_user.email,
        display_name=new_user.display_name,
        is_active=new_user.is_active,
        role="student",
    ))


@router.post("/students/login", response_model=APIResponse[StudentLoginResponse])
async def admin_login_as_student(
    body: StudentLoginRequest,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    """管理者が生徒としてログイン（代理ログイン）"""
    admin_user, tenant_id = admin

    # 生徒を検索
    result = await db.execute(
        select(User)
        .options(selectinload(User.memberships))
        .where(User.email == body.email)
    )
    student = result.scalar_one_or_none()

    if not student or not verify_password(body.password, student.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
        )

    # テナントに所属しているか確認
    membership = None
    for m in student.memberships:
        if m.tenant_id == tenant_id:
            membership = m
            break

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この生徒はこのテナントに所属していません",
        )

    if not student.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="このアカウントは無効化されています",
        )

    token = create_access_token({"sub": str(student.id)})
    return APIResponse(data=StudentLoginResponse(
        access_token=token,
        student=StudentResponse(
            id=student.id,
            email=student.email,
            display_name=student.display_name,
            is_active=student.is_active,
            role=membership.role,
        ),
    ))


@router.put("/students/{student_id}", response_model=APIResponse[StudentResponse])
async def update_student(
    student_id: UUID,
    body: StudentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    """管理者が生徒情報を更新"""
    admin_user, tenant_id = admin

    # テナント所属の確認
    result = await db.execute(
        select(Membership)
        .options(selectinload(Membership.user))
        .where(
            Membership.tenant_id == tenant_id,
            Membership.user_id == student_id,
            Membership.role == "student",
        )
    )
    membership = result.scalar_one_or_none()
    if not membership or not membership.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="この生徒が見つかりません",
        )

    student = membership.user
    if body.display_name is not None:
        student.display_name = body.display_name
    if body.is_active is not None:
        student.is_active = body.is_active
    if body.password is not None:
        student.hashed_password = hash_password(body.password)

    await db.commit()
    await db.refresh(student)

    return APIResponse(data=StudentResponse(
        id=student.id,
        email=student.email,
        display_name=student.display_name,
        is_active=student.is_active,
        role="student",
    ))


@router.delete("/students/{student_id}", response_model=APIResponse[dict])
async def delete_student(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: tuple = Depends(require_admin),
):
    """管理者が生徒のメンバーシップを削除（テナントから除外）"""
    admin_user, tenant_id = admin

    result = await db.execute(
        select(Membership).where(
            Membership.tenant_id == tenant_id,
            Membership.user_id == student_id,
            Membership.role == "student",
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="この生徒が見つかりません",
        )

    await db.delete(membership)
    await db.commit()

    return APIResponse(data={"deleted": True})
