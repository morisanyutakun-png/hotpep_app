from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    error: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    data: None = None
    error: dict[str, str]


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampSchema(BaseSchema):
    created_at: datetime
    updated_at: datetime
