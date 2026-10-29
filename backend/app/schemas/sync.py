# Pydantic schemas for Offline-First Sync operations.

from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

from app.schemas.item import ItemCreate, ItemResponse
from app.schemas.customer import CustomerCreate, CustomerResponse
from app.schemas.invoice import InvoiceCreate, InvoiceResponse
from app.schemas.payment import PaymentCreate, PaymentResponse


class SyncPushRequest(BaseModel):
    """Offline batch payload pushed from Flutter client to central server."""
    firm_id: int
    device_id: str = Field(..., max_length=100, description="Device UUID / identifier")
    items: List[ItemCreate] = []
    customers: List[CustomerCreate] = []
    invoices: List[InvoiceCreate] = []
    payments: List[PaymentCreate] = []


class SyncPushResponse(BaseModel):
    """Server confirmation and local-to-remote ID mappings."""
    status: str = "success"
    synced_at: datetime
    id_mappings: Dict[str, Dict[str, int]] = {
        "items": {},
        "customers": {},
        "invoices": {},
        "payments": {},
    }


class SyncPullRequest(BaseModel):
    """Delta-sync request from Flutter client."""
    firm_id: int
    last_synced_at: Optional[datetime] = Field(
        None,
        description="Timestamp of last successful sync. If omitted, performs initial full sync."
    )


class SyncPullResponse(BaseModel):
    """Changes updated on server since last_synced_at."""
    synced_at: datetime
    items: List[ItemResponse] = []
    customers: List[CustomerResponse] = []
    invoices: List[InvoiceResponse] = []
    payments: List[PaymentResponse] = []
