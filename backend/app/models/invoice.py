"""
models/invoice.py — Invoice and InvoiceItem tables.

Handles Indian GST Tax Invoices, Quotations, and Purchase Bills with:
- Automatic Intra-State (CGST + SGST) vs Inter-State (IGST) split.
- Default 5% GST rate support.
- Line items with HSN codes, discounts, and decimal precision.
- Payment tracking (Unpaid, Partial, Paid).
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime, Boolean, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class InvoiceType(str, enum.Enum):
    SALES = "sales"              # Tax Invoice / Sale
    PURCHASE = "purchase"        # Purchase Bill
    QUOTATION = "quotation"      # Estimate / Quotation
    PROFORMA = "proforma"        # Proforma Invoice
    CREDIT_NOTE = "credit_note"  # Sales return / credit adjustment
    DEBIT_NOTE = "debit_note"    # Purchase return / debit adjustment


class PaymentStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    sync_id = Column(String(36), nullable=True, unique=True, index=True)


    # Multi-tenant / Multi-firm & Party linkage
    firm_id = Column(Integer, ForeignKey("firms.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)

    # Document details
    invoice_number = Column(String(50), nullable=False, index=True)
    invoice_type = Column(
        Enum(InvoiceType, native_enum=False),
        default=InvoiceType.SALES,
        nullable=False,
    )
    invoice_date = Column(Date, nullable=False, default=func.current_date())
    due_date = Column(Date, nullable=True)

    # GST Place of Supply (2-digit state code, e.g. '27' for Maharashtra)
    place_of_supply = Column(String(2), nullable=True)
    is_reverse_charge = Column(Boolean, default=False, nullable=False)

    # Financial Summary
    subtotal = Column(Numeric(15, 2), default=0.00, nullable=False)
    total_cgst = Column(Numeric(15, 2), default=0.00, nullable=False)
    total_sgst = Column(Numeric(15, 2), default=0.00, nullable=False)
    total_igst = Column(Numeric(15, 2), default=0.00, nullable=False)
    total_tax = Column(Numeric(15, 2), default=0.00, nullable=False)
    total_discount = Column(Numeric(15, 2), default=0.00, nullable=False)
    round_off = Column(Numeric(15, 2), default=0.00, nullable=False)
    grand_total = Column(Numeric(15, 2), default=0.00, nullable=False)

    # Payment tracking
    paid_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    balance_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    payment_status = Column(
        Enum(PaymentStatus, native_enum=False),
        default=PaymentStatus.UNPAID,
        nullable=False,
    )

    notes = Column(String(500), nullable=True)
    terms_conditions = Column(String(1000), nullable=True)
    is_cancelled = Column(Boolean, default=False, nullable=False)

    # Transport & Dispatch Details (L.R. / Bilty / Vehicle / Bales)
    transport_name = Column(String(150), nullable=True)
    vehicle_number = Column(String(50), nullable=True)
    lr_number = Column(String(50), nullable=True)
    lr_date = Column(Date, nullable=True)
    destination = Column(String(100), nullable=True)
    number_of_parcels = Column(String(50), nullable=True)

    # Accurate ERP Billing & Purchase Details
    rate_type = Column(String(20), default="retail", nullable=True)
    vendor_bill_number = Column(String(50), nullable=True)
    vendor_bill_date = Column(Date, nullable=True)
    recd_date = Column(Date, nullable=True)
    transport_charges = Column(Numeric(15, 2), default=0.00, nullable=False)
    advance_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    card_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    cash_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    credit_amount = Column(Numeric(15, 2), default=0.00, nullable=False)

    # Goods Return Linkage (Credit Note & Debit Note)
    original_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    original_invoice_number = Column(String(50), nullable=True)
    return_reason = Column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Accurate Official .RPT Cloud PDF Integration
    official_pdf_drive_id = Column(String(100), nullable=True)
    official_pdf_url      = Column(String(500), nullable=True)
    pdf_updated_at        = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    firm = relationship("Firm")
    customer = relationship("Customer")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    original_invoice = relationship("Invoice", remote_side=[id], foreign_keys=[original_invoice_id])

    def __repr__(self) -> str:
        return f"<Invoice id={self.id} no='{self.invoice_number}' total=Rs.{self.grand_total}>"


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)

    item_name = Column(String(300), nullable=False)
    hsn_code = Column(String(8), nullable=True)
    size = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    mrp = Column(Numeric(15, 2), nullable=True)
    cd1_percent = Column(Numeric(5, 2), default=0.00, nullable=False)
    cd2_percent = Column(Numeric(5, 2), default=0.00, nullable=False)
    cd3_percent = Column(Numeric(5, 2), default=0.00, nullable=False)
    remarks = Column(String(200), nullable=True)

    quantity = Column(Numeric(12, 3), default=1.000, nullable=False)
    uom = Column(String(20), default="Pcs", nullable=False)
    rate = Column(Numeric(15, 2), default=0.00, nullable=False)

    discount_percent = Column(Numeric(5, 2), default=0.00, nullable=False)
    discount_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    taxable_amount = Column(Numeric(15, 2), default=0.00, nullable=False)

    # Default GST rate set to 5%
    gst_rate = Column(Numeric(5, 2), default=5.00, nullable=False)
    cgst_rate = Column(Numeric(5, 2), default=2.50, nullable=False)
    cgst_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    sgst_rate = Column(Numeric(5, 2), default=2.50, nullable=False)
    sgst_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    igst_rate = Column(Numeric(5, 2), default=0.00, nullable=False)
    igst_amount = Column(Numeric(15, 2), default=0.00, nullable=False)

    total_amount = Column(Numeric(15, 2), default=0.00, nullable=False)

    invoice = relationship("Invoice", back_populates="items")
    item = relationship("Item")

    def __repr__(self) -> str:
        return f"<InvoiceItem id={self.id} name='{self.item_name}' qty={self.quantity} total=Rs.{self.total_amount}>"
