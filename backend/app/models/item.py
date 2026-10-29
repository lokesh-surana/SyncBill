"""
models/item.py — The "Item" (Product/Service) table.

This is the most complex model because items in an Indian wholesale business have:

1. DUAL UOM (Unit of Measure):
   - "Primary UOM": what you sell in (e.g., Piece, Kg, Litre)
   - "Secondary UOM": what you buy/stock in (e.g., Box, Carton, Dozen)
   - A conversion factor between them (e.g., 1 Box = 12 Pieces)

2. MULTI-TIER PRICING:
   - Purchase Rate  : what you pay your supplier
   - Wholesale Rate : what you charge bulk/business buyers
   - Retail Rate    : what you charge walk-in customers
   - MRP            : Maximum Retail Price (printed on the package)

3. GST COMPLIANCE:
   - HSN Code       : 4-8 digit commodity code assigned by the GST council
   - GST Rate       : total GST % (e.g., 18% = 9% CGST + 9% SGST for intra-state)

4. INVENTORY:
   - Current stock quantity (in primary UOM)
   - Reorder level (trigger a purchase alert when stock falls below this)
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, Boolean, Float
)
from sqlalchemy.sql import func

from app.database import Base


class Item(Base):
    """
    Product or service master. One row per unique SKU (Stock Keeping Unit).
    """

    __tablename__ = "items"

    # ── Primary Key & Sync Identity ─────────────────────────────────────────
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    sync_id = Column(String(36), nullable=True, unique=True, index=True)

    # ── Item Identity ────────────────────────────────────────────────────────
    name = Column(
        String(300),
        nullable=False,
        index=True,     # Searched by name very often (typeahead in Flutter)
    )
    # Item code: your internal SKU code. e.g., "ELEC-001" or "SP-PINS-10MM"
    item_code = Column(String(50), nullable=True, unique=True, index=True)

    # Category / Section (e.g. "READYMADE GARMENTS", "T-SHIRTS", "JACKET", etc.)
    category = Column(String(100), nullable=True, default="READYMADE GARMENTS", index=True)

    # Size (e.g. "20/26", "26/30", "M/XXL", "Free", etc.)
    size = Column(String(50), nullable=True)

    # Item Type (e.g. "Readymade", "Fabric", "Accessories", etc.)
    item_type = Column(String(50), nullable=True, default="Readymade", index=True)

    # A short description visible on printed invoices
    description = Column(String(500), nullable=True)

    # ── GST Details ──────────────────────────────────────────────────────────
    # HSN = Harmonised System of Nomenclature. A global product classification code.
    # Example: HSN 3926 = "Articles of plastics". Required for B2B GST invoices.
    hsn_code = Column(String(8), nullable=True, index=True)

    # GST rate as a percentage. Use Numeric to avoid floating-point errors.
    # Examples: 0.00 (exempt), 5.00, 12.00, 18.00, 28.00
    gst_rate = Column(
        Numeric(5, 2),  # Up to 999.99 — more than enough for any GST rate
        nullable=False,
        default=5.00,   # Set to 5% by default as requested
    )

    # ── Dual UOM ─────────────────────────────────────────────────────────────
    # PRIMARY UOM: the unit used for selling and billing.
    # Examples: "Pcs", "Kg", "Ltr", "Mtr"
    primary_uom = Column(String(20), nullable=False, default="Pcs")

    # SECONDARY UOM: the unit used for purchasing / storing in bulk.
    # Examples: "Box", "Carton", "Dozen", "Pack"
    # If null, it means there is only one unit (no dual UOM needed).
    secondary_uom = Column(String(20), nullable=True)

    # CONVERSION FACTOR: how many primary units make one secondary unit.
    # Example: 1 Box = 12 Pieces → conversion_factor = 12.0
    # If secondary_uom is null, this value is ignored.
    uom_conversion_factor = Column(
        Float,          # Float is fine here (not money, just a ratio)
        nullable=True,
        default=1.0,    # Default: 1-to-1 (no conversion needed)
        comment="How many primary units = 1 secondary unit. e.g. 12 Pcs per Box."
    )

    # ── Multi-Tier Pricing ───────────────────────────────────────────────────
    # All prices are EXCLUDING GST (we add GST separately during billing).
    # Numeric(15, 2) = supports prices up to ₹99,999,999,999,999.99

    # What you paid your supplier for this item (per primary UOM).
    purchase_rate = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Price for bulk buyers / distributors (per primary UOM).
    wholesale_rate = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Price for walk-in retail customers (per primary UOM).
    retail_rate = Column(Numeric(15, 2), nullable=False, default=0.00)

    # MRP: the government-mandated maximum price. You cannot legally sell above this.
    mrp = Column(Numeric(15, 2), nullable=True)

    # ── Inventory ────────────────────────────────────────────────────────────
    # Current stock level in PRIMARY UOM.
    # Updated every time a sale or purchase is recorded.
    current_stock = Column(Numeric(15, 3), nullable=False, default=0.000)
    # 3 decimal places for items sold by weight (e.g. 2.500 Kg)

    # When stock falls to or below this level, the system warns: "Time to reorder!"
    reorder_level = Column(Numeric(15, 3), nullable=True, default=0.000)

    # ── Flags ────────────────────────────────────────────────────────────────
    # Is this item a "Service" (e.g., installation fees) or a physical "Product"?
    # Services don't have stock. We skip inventory tracking for them.
    is_service = Column(Boolean, default=False, nullable=False)

    # Soft delete flag — deactivating hides the item from new bills
    # but preserves it in old invoice records.
    is_active = Column(Boolean, default=True, nullable=False)

    # ── Audit Timestamps ─────────────────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return (
            f"<Item id={self.id} name='{self.name}' "
            f"hsn='{self.hsn_code}' gst={self.gst_rate}% "
            f"retail=Rs.{self.retail_rate} stock={self.current_stock} {self.primary_uom}>"
        )
