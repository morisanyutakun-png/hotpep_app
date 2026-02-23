from pydantic import BaseModel, EmailStr
from uuid import UUID
from schemas.common import BaseSchema, TimestampSchema


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"


class UserResponse(TimestampSchema):
    id: UUID
    email: str
    display_name: str
    is_active: bool


class UserWithMembership(UserResponse):
    memberships: list["MembershipInfo"] = []


class MembershipInfo(BaseSchema):
    id: UUID
    tenant_id: UUID
    role: str
    tenant_name: str | None = None


class MeResponse(BaseSchema):
    user: UserResponse
    memberships: list[MembershipInfo] = []
