# Pydantic schemas for Firm CRUD operations.

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class FirmBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    gstin: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=500)
    fy_start: Optional[date] = None
    fy_end: Optional[date] = None
    is_active: bool = True


class FirmCreate(FirmBase):
    pass


class FirmUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    gstin: Optional[str] = Field(None, max_length=15)
    address: Optional[str] = Field(None, max_length=500)
    fy_start: Optional[date] = None
    fy_end: Optional[date] = None
    is_active: Optional[bool] = None


class FirmResponse(FirmBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
