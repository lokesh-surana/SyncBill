from app.routers.items import router as items_router
from app.routers.firms import router as firms_router
from app.routers.customers import router as customers_router
from app.routers.invoices import router as invoices_router
from app.routers.payments import router as payments_router
from app.routers.sync import router as sync_router
from app.routers.reports import router as reports_router
from app.routers.whatsapp import router as whatsapp_router

__all__ = [
    "items_router", "firms_router", "customers_router",
    "invoices_router", "payments_router", "sync_router",
    "reports_router", "whatsapp_router",
]




