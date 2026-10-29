# Pydantic schemas for the Item model.
# Schemas define the shape of data coming IN (requests) and going OUT (responses).
# They are separate from SQLAlchemy models because the API might expose
# different fields than what's stored in the DB (e.g., hide created_at from input).

from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime


class ItemBase(BaseModel):
    """Fields shared by create and update operations."""
    sync_id: Optional[str] = Field(None, max_length=36)
    name: str = Field(..., min_length=1, max_length=300)
    item_code: Optional[str] = Field(None, max_length=50)
    item_type: Optional[str] = Field(default="Readymade", max_length=50)
    category: Optional[str] = Field(default="READYMADE GARMENTS", max_length=100)
    size: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    hsn_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Decimal = Field(default=Decimal("5.00"), ge=0, le=100)
    primary_uom: str = Field(default="Pcs", max_length=20)
    secondary_uom: Optional[str] = Field(None, max_length=20)
    uom_conversion_factor: Optional[float] = Field(default=1.0, gt=0)
    purchase_rate: Decimal = Field(default=Decimal("0.00"), ge=0)
    wholesale_rate: Decimal = Field(default=Decimal("0.00"), ge=0)
    retail_rate: Decimal = Field(default=Decimal("0.00"), ge=0)
    mrp: Optional[Decimal] = Field(None, ge=0)
    current_stock: Decimal = Field(default=Decimal("0.000"), ge=0)
    reorder_level: Optional[Decimal] = Field(default=Decimal("0.000"), ge=0)
    is_service: bool = False
    is_active: bool = True


class ItemCreate(ItemBase):
    """Schema for creating a new item. Inherits all fields from ItemBase."""
    pass


class ItemUpdate(BaseModel):
    """Schema for updating an item. All fields are optional (partial update)."""
    name: Optional[str] = Field(None, min_length=1, max_length=300)
    item_code: Optional[str] = Field(None, max_length=50)
    item_type: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    hsn_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    primary_uom: Optional[str] = Field(None, max_length=20)
    secondary_uom: Optional[str] = None
    uom_conversion_factor: Optional[float] = Field(None, gt=0)
    purchase_rate: Optional[Decimal] = Field(None, ge=0)
    wholesale_rate: Optional[Decimal] = Field(None, ge=0)
    retail_rate: Optional[Decimal] = Field(None, ge=0)
    mrp: Optional[Decimal] = Field(None, ge=0)
    current_stock: Optional[Decimal] = Field(None, ge=0)
    reorder_level: Optional[Decimal] = Field(None, ge=0)
    is_service: Optional[bool] = None
    is_active: Optional[bool] = None


class ItemResponse(ItemBase):
    """Schema for returning an item to the client. Includes DB-generated fields."""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}  # Tells Pydantic to read from SQLAlchemy objects
