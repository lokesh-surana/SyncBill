"""
models/firm.py — The "Firm" table.

A Firm is your company (or your client's company). In India's GST system,
every business has a GSTIN (GST Identification Number). One software
installation might manage multiple firms (e.g., a CA managing 3 companies).

Columns we need:
  - id          : auto-incrementing integer, the unique row identifier
  - name        : the company's legal name
  - gstin       : 15-character GST number, must be unique per firm
  - address     : physical address (optional)
  - fy_start    : Financial Year start date (April 1 in India)
  - fy_end      : Financial Year end date (March 31 in India)
  - created_at  : timestamp when this row was created (auto-set by DB)
  - updated_at  : timestamp when this row was last modified (auto-updated)
"""

# We import everything we need from SQLAlchemy.
# Think of "Column" as one box in a spreadsheet row.
from sqlalchemy import (
    Column,       # Defines a single column in the table
    Integer,      # An integer data type (whole numbers: 1, 2, 3...)
    String,       # A text data type (like VARCHAR in SQL)
    Date,         # A date-only type (YYYY-MM-DD)
    DateTime,     # A date + time type (YYYY-MM-DD HH:MM:SS)
    Boolean,      # True or False
)
from sqlalchemy.sql import func  # func.now() = "use the DB's current timestamp"

# We import Base from our database.py file.
# "Base" is the parent class that gives our model its ORM powers.
from app.database import Base


# ── The Firm Model ────────────────────────────────────────────────────────────
# "class Firm(Base)" means: "Firm inherits from Base."
# Inheriting from Base is what registers this class with SQLAlchemy as a table.
class Firm(Base):
    """Represents a business entity / company registered in SyncBill."""

    # __tablename__ tells SQLAlchemy what to name the table in the database.
    # The Python class is called "Firm" but the DB table is called "firms".
    # Convention: table names are lowercase and plural.
    __tablename__ = "firms"

    # ── Primary Key ──────────────────────────────────────────────────────────
    # Every table needs a PRIMARY KEY — the unique identifier for each row.
    # "autoincrement=True" means the DB assigns the number automatically: 1, 2, 3...
    id = Column(
        Integer,
        primary_key=True,   # This is the unique identifier column
        autoincrement=True, # The database automatically assigns the next number
        index=True,         # Create a database index for faster lookups by id
    )

    # ── Company Name ─────────────────────────────────────────────────────────
    # nullable=False means this column CANNOT be empty. It's required.
    name = Column(
        String(200),   # Text up to 200 characters long
        nullable=False,
        index=True,    # Index because we'll often search firms by name
    )

    # ── GSTIN ────────────────────────────────────────────────────────────────
    # GSTIN format: 27ABCDE1234F1Z5 (always 15 characters in India)
    # unique=True means no two firms can share the same GSTIN.
    gstin = Column(
        String(15),
        nullable=True,   # nullable=True = optional (some micro-businesses may not have GST)
        unique=True,     # Each GSTIN can only appear once in this table
    )

    # ── Address ──────────────────────────────────────────────────────────────
    address = Column(
        String(500),  # Long enough for a full mailing address
        nullable=True,
    )

    # ── Financial Year Dates ─────────────────────────────────────────────────
    # In India, the financial year runs April 1 → March 31.
    # Example: fy_start = 2024-04-01, fy_end = 2025-03-31
    fy_start = Column(Date, nullable=True)
    fy_end = Column(Date, nullable=True)

    # ── Active Flag ──────────────────────────────────────────────────────────
    # Instead of deleting a firm (which could break old invoices),
    # we "soft delete" by setting is_active=False.
    is_active = Column(
        Boolean,
        default=True,   # New firms are active by default
        nullable=False,
    )

    # ── Audit Timestamps ─────────────────────────────────────────────────────
    # server_default=func.now() means the DATABASE sets this value automatically
    # when a new row is inserted. We don't need to set it in Python.
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),  # Auto-set to "right now" on INSERT
    )

    # onupdate=func.now() means the DB updates this timestamp every time
    # the row is modified. Perfect for audit trails.
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),        # Auto-update on every UPDATE statement
    )

    # ── String Representation ────────────────────────────────────────────────
    # __repr__ controls what you see when you print() a Firm object.
    # Without this, Python prints something ugly like <app.models.firm.Firm object at 0x...>
    def __repr__(self) -> str:
        return f"<Firm id={self.id} name='{self.name}' gstin='{self.gstin}'>"
