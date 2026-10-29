"""
models/customer.py — The "Customer" table (Unified Ledger approach).

In a traditional ERP, "customers" (people who buy from you) and "vendors"
(people you buy from) are separate tables. But in practice, many businesses
buy AND sell with the same party (e.g., a distributor).

The "Unified Ledger" approach uses ONE table for all parties, with a type flag
to mark whether they are a Customer, Vendor, or Both.

Columns:
  - id, name, gstin        : standard identification
  - party_type             : 'customer', 'vendor', or 'both'
  - phone, email           : contact details
  - billing_address        : for invoice printing
  - credit_limit           : max outstanding balance allowed (₹)
  - credit_days            : payment due within N days
  - opening_balance        : balance before SyncBill was installed
  - is_active, timestamps  : standard audit fields
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, Boolean, Enum
)
from sqlalchemy.sql import func
import enum  # Python's built-in enum module — lets us define a fixed set of values

from app.database import Base


# ── Party Type Enum ────────────────────────────────────────────────────────────
# An "Enum" is a way to restrict a column to a fixed list of values.
# The database will REJECT any value not in this list, preventing typos.
class PartyType(str, enum.Enum):
    """Defines valid party types for the Customer/Vendor unified ledger."""
    CUSTOMER = "customer"  # Buys from us
    VENDOR   = "vendor"    # We buy from them
    BOTH     = "both"      # Buys from us AND we buy from them


# ── The Customer Model ─────────────────────────────────────────────────────────
class Customer(Base):
    """
    Unified party ledger — represents customers, vendors, or both.
    This single table replaces the need for separate Customer and Vendor tables.
    """

    __tablename__ = "customers"

    # ── Primary Key & Sync Identity ────────────────────────────────────────
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    sync_id = Column(String(36), nullable=True, unique=True, index=True)

    # ── Identity ───────────────────────────────────────────────────────────
    name = Column(
        String(300),
        nullable=False,
        index=True,  # We'll search customers by name very frequently
    )

    # GSTIN: optional because individual customers rarely have GST numbers.
    # Businesses (B2B) will have it; retail walk-in customers (B2C) won't.
    gstin = Column(String(15), nullable=True, unique=True)

    # ── Party Classification ────────────────────────────────────────────────
    # Enum(PartyType) restricts this column to the three valid values above.
    # native_enum=False stores it as a VARCHAR in the DB (works with SQLite too).
    party_type = Column(
        Enum(PartyType, native_enum=False),
        default=PartyType.CUSTOMER,
        nullable=False,
    )

    # ── Contact Information ─────────────────────────────────────────────────
    phone   = Column(String(20),  nullable=True)
    email   = Column(String(200), nullable=True)
    billing_address = Column(String(500), nullable=True)
    state_code = Column(
        String(2),
        nullable=True,
        comment="2-digit state code for GST (e.g. '27' for Maharashtra). "
                "Used to determine CGST+SGST vs IGST."
    )

    # ── Credit Terms ────────────────────────────────────────────────────────
    # Numeric(15, 2) means: up to 15 digits total, with 2 decimal places.
    # This is the correct type for money — Float can have rounding errors!
    credit_limit = Column(
        Numeric(15, 2),
        default=0.00,   # 0 means no credit limit set
        nullable=False,
    )
    credit_days = Column(
        Integer,
        default=0,      # 0 means payment is due immediately
        nullable=False,
    )

    # ── Opening Balance ─────────────────────────────────────────────────────
    # When you migrate from old software (like Accurate), this stores
    # the starting balance that was already owed before SyncBill.
    # Positive = customer owes us money. Negative = we owe the customer.
    opening_balance = Column(Numeric(15, 2), default=0.00, nullable=False)

    # ── Soft Delete & Timestamps ────────────────────────────────────────────
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # ── Accurate Official .RPT Cloud PDF Integration ────────────────────────
    official_pdf_drive_id = Column(String(100), nullable=True)
    official_pdf_url      = Column(String(500), nullable=True)
    pdf_updated_at        = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<Customer id={self.id} name='{self.name}' "
            f"type={self.party_type.value} gstin='{self.gstin}'>"
        )
