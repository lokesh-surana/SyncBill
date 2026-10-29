"""
models/payment.py — Payment and Receipt transactions.

Tracks:
- Customer receipts (Cash, UPI, Cheque, Bank Transfer)
- Vendor payments
- Direct invoice settlement or On-Account advances
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime, Boolean, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class PaymentType(str, enum.Enum):
    RECEIPT = "receipt"  # Money IN from customer
    PAYMENT = "payment"  # Money OUT to vendor


class PaymentMode(str, enum.Enum):
    CASH = "cash"
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"
    CARD = "card"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    sync_id = Column(String(36), nullable=True, unique=True, index=True)


    firm_id = Column(Integer, ForeignKey("firms.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)

    payment_number = Column(String(50), nullable=False, index=True)
    payment_type = Column(
        Enum(PaymentType, native_enum=False),
        default=PaymentType.RECEIPT,
        nullable=False,
    )
    payment_mode = Column(
        Enum(PaymentMode, native_enum=False),
        default=PaymentMode.CASH,
        nullable=False,
    )

    amount = Column(Numeric(15, 2), nullable=False)
    payment_date = Column(Date, nullable=False, default=func.current_date())

    # Reference / Transaction ID (e.g., UPI UTR, Cheque number)
    reference_number = Column(String(100), nullable=True)
    notes = Column(String(500), nullable=True)
    is_cancelled = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    firm = relationship("Firm")
    customer = relationship("Customer")
    invoice = relationship("Invoice")

    def __repr__(self) -> str:
        return f"<Payment id={self.id} no='{self.payment_number}' type={self.payment_type} amt=Rs.{self.amount}>"
