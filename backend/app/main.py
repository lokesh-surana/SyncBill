from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import Base, engine
import app.models  # Ensures all SQLAlchemy models are registered
from app.routers import (
    items_router, firms_router, customers_router,
    invoices_router, payments_router, sync_router, reports_router,
    whatsapp_router,
)


# Create tables if not already present
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Ensure new Accurate ERP columns exist in SQLite tables
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            inv_cols = [
                ('transport_name', 'TEXT'),
                ('vehicle_number', 'TEXT'),
                ('lr_number', 'TEXT'),
                ('lr_date', 'DATE'),
                ('destination', 'TEXT'),
                ('number_of_parcels', 'TEXT'),
                ('rate_type', "TEXT DEFAULT 'retail'"),
                ('vendor_bill_number', 'TEXT'),
                ('vendor_bill_date', 'DATE'),
                ('recd_date', 'DATE'),
                ('transport_charges', 'NUMERIC DEFAULT 0.00'),
                ('advance_amount', 'NUMERIC DEFAULT 0.00'),
                ('card_amount', 'NUMERIC DEFAULT 0.00'),
                ('cash_amount', 'NUMERIC DEFAULT 0.00'),
                ('credit_amount', 'NUMERIC DEFAULT 0.00'),
            ]
            for col, col_t in inv_cols:
                try:
                    conn.execute(text(f"ALTER TABLE invoices ADD COLUMN {col} {col_t}"))
                    conn.commit()
                except Exception:
                    pass

            item_cols = [
                ('color', 'TEXT'),
                ('cd3_percent', 'NUMERIC DEFAULT 0.00'),
                ('remarks', 'TEXT'),
            ]
            for col, col_t in item_cols:
                try:
                    conn.execute(text(f"ALTER TABLE invoice_items ADD COLUMN {col} {col_t}"))
                    conn.commit()
                except Exception:
                    pass
    except Exception:
        pass
    yield


app = FastAPI(
    title="SyncBill ERP API",
    version="1.0.0",
    description="High-performance backend API for SyncBill ERP (GST Billing & Inventory)",
    lifespan=lifespan,
)

# Enable CORS for web, desktop, and mobile clients across LAN and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers with /api/v1 prefix
app.include_router(firms_router, prefix="/api/v1")
app.include_router(items_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")
app.include_router(invoices_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(sync_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(whatsapp_router, prefix="/api/v1")


@app.get("/api", tags=["System"])
def root():
    return {
        "app": "SyncBill ERP",
        "version": "1.0.0",
        "status": "online",
        "docs_url": "/docs",
    }


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "healthy"}

# Mount built React frontend for production single-process desktop app
import os
from fastapi.staticfiles import StaticFiles

_FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(_FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
