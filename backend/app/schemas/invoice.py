# Pydantic schemas for Invoice and InvoiceItem.

from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from app.models.invoice import InvoiceType, PaymentStatus
from app.schemas.customer import CustomerResponse


class InvoiceItemBase(BaseModel):
    item_id: Optional[int] = None
    item_name: str = Field(..., min_length=1, max_length=300)
    hsn_code: Optional[str] = Field(None, max_length=8)
    size: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=50)
    mrp: Optional[Decimal] = Field(None, ge=0)
    cd1_percent: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    cd2_percent: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    cd3_percent: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    remarks: Optional[str] = Field(None, max_length=200)
    quantity: Decimal = Field(default=Decimal("1.000"), gt=0)
    uom: str = Field(default="Pcs", max_length=20)
    rate: Decimal = Field(..., ge=0)
    discount_percent: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    gst_rate: Decimal = Field(default=Decimal("5.00"), ge=0, le=100)  # Default 5% tax


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemResponse(InvoiceItemBase):
    id: int
    invoice_id: int
    discount_amount: Decimal
    taxable_amount: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    total_amount: Decimal

    model_config = {"from_attributes": True}


class InvoiceBase(BaseModel):
    sync_id: Optional[str] = Field(None, max_length=36)
    firm_id: int
    customer_id: int
    invoice_number: Optional[str] = Field(None, max_length=50)
    invoice_type: InvoiceType = Field(default=InvoiceType.SALES)
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    place_of_supply: Optional[str] = Field(None, max_length=2)
    is_reverse_charge: bool = False
    notes: Optional[str] = Field(None, max_length=500)
    terms_conditions: Optional[str] = Field(None, max_length=1000)
    paid_amount: Decimal = Field(default=Decimal("0.00"), ge=0)

    # Transport & Dispatch Details
    transport_name: Optional[str] = Field(None, max_length=150)
    vehicle_number: Optional[str] = Field(None, max_length=50)
    lr_number: Optional[str] = Field(None, max_length=50)
    lr_date: Optional[date] = None
    destination: Optional[str] = Field(None, max_length=100)
    number_of_parcels: Optional[str] = Field(None, max_length=50)

    # Accurate ERP Billing & Purchase Details
    rate_type: Optional[str] = Field(default="retail", max_length=20)
    vendor_bill_number: Optional[str] = Field(None, max_length=50)
    vendor_bill_date: Optional[date] = None
    recd_date: Optional[date] = None
    transport_charges: Decimal = Field(default=Decimal("0.00"), ge=0)
    advance_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    card_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    cash_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    credit_amount: Decimal = Field(default=Decimal("0.00"), ge=0)

    # Goods Return Linkage (Credit Note & Debit Note)
    original_invoice_id: Optional[int] = None
    original_invoice_number: Optional[str] = Field(None, max_length=50)
    return_reason: Optional[str] = Field(None, max_length=255)


class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate] = Field(..., min_length=1)


class InvoiceResponse(InvoiceBase):
    id: int
    subtotal: Decimal
    total_cgst: Decimal
    total_sgst: Decimal
    total_igst: Decimal
    total_tax: Decimal
    total_discount: Decimal
    round_off: Decimal
    grand_total: Decimal
    balance_amount: Decimal
    payment_status: PaymentStatus
    is_cancelled: bool
    official_pdf_drive_id: Optional[str] = None
    official_pdf_url: Optional[str] = None
    pdf_updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[InvoiceItemResponse] = []
    customer: Optional[CustomerResponse] = None

    model_config = {"from_attributes": True}
