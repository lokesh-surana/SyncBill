# Pydantic schemas for Payment and Receipt operations.

from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from app.models.payment import PaymentType, PaymentMode


class BillAllocation(BaseModel):
    invoice_id: int
    amount: Decimal = Field(..., gt=0)


class PaymentBase(BaseModel):
    sync_id: Optional[str] = Field(None, max_length=36)
    firm_id: int
    customer_id: int
    invoice_id: Optional[int] = None
    payment_number: Optional[str] = Field(None, max_length=50)
    payment_type: PaymentType = Field(default=PaymentType.RECEIPT)
    payment_mode: PaymentMode = Field(default=PaymentMode.CASH)
    amount: Decimal = Field(..., gt=0)
    payment_date: Optional[date] = None
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)
    allocations: Optional[List[BillAllocation]] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentResponse(PaymentBase):
    id: int
    is_cancelled: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
