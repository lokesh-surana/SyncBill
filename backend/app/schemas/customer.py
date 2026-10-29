# Pydantic schemas for Customer/Vendor CRUD operations.

from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.models.customer import PartyType


class CustomerBase(BaseModel):
    sync_id: Optional[str] = Field(None, max_length=36)
    name: str = Field(..., min_length=1, max_length=300)
    gstin: Optional[str] = Field(None, max_length=15)
    party_type: PartyType = Field(default=PartyType.CUSTOMER)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=200)
    billing_address: Optional[str] = Field(None, max_length=500)
    state_code: Optional[str] = Field(None, max_length=2)
    credit_limit: Decimal = Field(default=Decimal("0.00"), ge=0)
    credit_days: int = Field(default=0, ge=0)
    opening_balance: Decimal = Field(default=Decimal("0.00"))
    is_active: bool = True


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=300)
    gstin: Optional[str] = Field(None, max_length=15)
    party_type: Optional[PartyType] = None
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=200)
    billing_address: Optional[str] = Field(None, max_length=500)
    state_code: Optional[str] = Field(None, max_length=2)
    credit_limit: Optional[Decimal] = Field(None, ge=0)
    credit_days: Optional[int] = Field(None, ge=0)
    opening_balance: Optional[Decimal] = None
    is_active: Optional[bool] = None
    official_pdf_drive_id: Optional[str] = None
    official_pdf_url: Optional[str] = None
    pdf_updated_at: Optional[datetime] = None


class CustomerResponse(CustomerBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    official_pdf_drive_id: Optional[str] = None
    official_pdf_url: Optional[str] = None
    pdf_updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
