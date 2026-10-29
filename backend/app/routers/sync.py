from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone, date
from typing import Dict, List, Optional, Any
from decimal import Decimal

from app.database import get_db
from app.models.firm import Firm
from app.models.customer import Customer, PartyType
from app.models.item import Item
from app.models.invoice import Invoice, InvoiceItem, InvoiceType, PaymentStatus
from app.models.payment import Payment
from app.schemas.sync import (
    SyncPushRequest, SyncPushResponse,
    SyncPullRequest, SyncPullResponse,
)
from app.routers.invoices import create_invoice
from app.routers.payments import record_payment

router = APIRouter(prefix="/sync", tags=["Offline-First Sync Engine"])


@router.post("/push", response_model=SyncPushResponse)
def sync_push(payload: SyncPushRequest, db: Session = Depends(get_db)):
    """
    Ingest a batch of offline mutations from Flutter:
    - Idempotent upsert via sync_id / UUID.
    - Resolves local client foreign keys to server IDs.
    - Adjusts inventory and tax calculations automatically.
    - Returns local-to-remote ID mappings.
    """
    firm = db.query(Firm).filter(Firm.id == payload.firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail=f"Firm {payload.firm_id} not found.")

    id_mappings: Dict[str, Dict[str, int]] = {
        "items": {},
        "customers": {},
        "invoices": {},
        "payments": {},
    }

    # 1. Upsert Items
    for item_in in payload.items:
        existing_item = None
        if item_in.sync_id:
            existing_item = db.query(Item).filter(Item.sync_id == item_in.sync_id).first()
        if not existing_item and item_in.item_code:
            existing_item = db.query(Item).filter(Item.item_code == item_in.item_code).first()

        if existing_item:
            # Update fields
            for field, val in item_in.model_dump(exclude_unset=True).items():
                if field != "id":
                    setattr(existing_item, field, val)
            db.commit()
            db.refresh(existing_item)
            target_item = existing_item
        else:
            new_item = Item(**item_in.model_dump())
            db.add(new_item)
            db.commit()
            db.refresh(new_item)
            target_item = new_item

        key = item_in.sync_id or str(target_item.id)
        id_mappings["items"][key] = target_item.id

    # 2. Upsert Customers / Vendors
    for cust_in in payload.customers:
        existing_cust = None
        if cust_in.sync_id:
            existing_cust = db.query(Customer).filter(Customer.sync_id == cust_in.sync_id).first()
        if not existing_cust and cust_in.gstin:
            existing_cust = db.query(Customer).filter(Customer.gstin == cust_in.gstin).first()

        if existing_cust:
            for field, val in cust_in.model_dump(exclude_unset=True).items():
                if field != "id":
                    setattr(existing_cust, field, val)
            db.commit()
            db.refresh(existing_cust)
            target_cust = existing_cust
        else:
            new_cust = Customer(**cust_in.model_dump())
            db.add(new_cust)
            db.commit()
            db.refresh(new_cust)
            target_cust = new_cust

        key = cust_in.sync_id or str(target_cust.id)
        id_mappings["customers"][key] = target_cust.id

    # 3. Process Invoices (Idempotent by sync_id)
    for inv_in in payload.invoices:
        if inv_in.sync_id:
            existing_inv = db.query(Invoice).filter(Invoice.sync_id == inv_in.sync_id).first()
            if existing_inv:
                id_mappings["invoices"][inv_in.sync_id] = existing_inv.id
                continue

        # If customer_id maps to a local sync_id, resolve it
        if inv_in.customer_id in id_mappings["customers"]:
            inv_in.customer_id = id_mappings["customers"][str(inv_in.customer_id)]

        # Resolve line item IDs if needed
        for line in inv_in.items:
            if line.item_id and str(line.item_id) in id_mappings["items"]:
                line.item_id = id_mappings["items"][str(line.item_id)]

        created_inv = create_invoice(invoice_in=inv_in, db=db)
        if inv_in.sync_id:
            created_inv.sync_id = inv_in.sync_id
            db.commit()

        key = inv_in.sync_id or str(created_inv.id)
        id_mappings["invoices"][key] = created_inv.id

    # 4. Process Payments (Idempotent by sync_id)
    for pmt_in in payload.payments:
        if pmt_in.sync_id:
            existing_pmt = db.query(Payment).filter(Payment.sync_id == pmt_in.sync_id).first()
            if existing_pmt:
                id_mappings["payments"][pmt_in.sync_id] = existing_pmt.id
                continue

        # Resolve customer and invoice IDs if local UUID was used
        if pmt_in.customer_id in id_mappings["customers"]:
            pmt_in.customer_id = id_mappings["customers"][str(pmt_in.customer_id)]
        if pmt_in.invoice_id and str(pmt_in.invoice_id) in id_mappings["invoices"]:
            pmt_in.invoice_id = id_mappings["invoices"][str(pmt_in.invoice_id)]

        created_pmt = record_payment(payment_in=pmt_in, db=db)
        if pmt_in.sync_id:
            created_pmt.sync_id = pmt_in.sync_id
            db.commit()

        key = pmt_in.sync_id or str(created_pmt.id)
        id_mappings["payments"][key] = created_pmt.id

    return SyncPushResponse(
        status="success",
        synced_at=datetime.now(timezone.utc),
        id_mappings=id_mappings,
    )


@router.post("/pull", response_model=SyncPullResponse)
def sync_pull(payload: SyncPullRequest, db: Session = Depends(get_db)):
    """
    Fetch delta changes from server since last_synced_at timestamp.
    """
    firm = db.query(Firm).filter(Firm.id == payload.firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail=f"Firm {payload.firm_id} not found.")

    items_query = db.query(Item)
    cust_query = db.query(Customer)
    inv_query = db.query(Invoice).filter(Invoice.firm_id == payload.firm_id)
    pmt_query = db.query(Payment).filter(Payment.firm_id == payload.firm_id)

    if payload.last_synced_at:
        items_query = items_query.filter(Item.updated_at > payload.last_synced_at)
        cust_query = cust_query.filter(Customer.updated_at > payload.last_synced_at)
        inv_query = inv_query.filter(Invoice.updated_at > payload.last_synced_at)
        pmt_query = pmt_query.filter(Payment.updated_at > payload.last_synced_at)

    return SyncPullResponse(
        synced_at=datetime.now(timezone.utc),
        items=items_query.all(),
        customers=cust_query.all(),
        invoices=inv_query.all(),
        payments=pmt_query.all(),
    )


# ══════════════════════════════════════════════════════════════════════════════
# 🖥️ ACCURATE ERP (OLD PC) LIVE SYNC BRIDGE
# ══════════════════════════════════════════════════════════════════════════════

# In-memory record of the last sync events for the UI dashboard
LAST_SYNC_STATUS = {
    "status": "idle",
    "last_sync_time": None,
    "last_machine": None,
    "invoices_added": 0,
    "parties_added": 0,
    "items_added": 0,
}


@router.get("/status")
def get_sync_status(db: Session = Depends(get_db)):
    """
    Check connectivity and live database totals.
    Used by the Old PC agent to test connection, and by the UI to display live sync health.
    """
    total_sales = db.query(Invoice).filter(Invoice.invoice_type == InvoiceType.SALES, Invoice.is_cancelled == False).count()
    total_purchases = db.query(Invoice).filter(Invoice.invoice_type == InvoiceType.PURCHASE, Invoice.is_cancelled == False).count()
    total_parties = db.query(Customer).filter(Customer.is_active == True).count()
    total_items = db.query(Item).filter(Item.is_active == True).count()

    return {
        "sync_engine": "Online",
        "last_sync": LAST_SYNC_STATUS,
        "database_totals": {
            "sales_invoices": total_sales,
            "purchase_bills": total_purchases,
            "parties": total_parties,
            "items": total_items,
        },
        "server_time": datetime.now().isoformat(),
    }


class AccurateSyncPayload(BaseModel):
    secret_token: str
    machine_name: Optional[str] = "Old-PC"
    firm_name: Optional[str] = "APEX APPARELS & TEXTILES"
    invoices: List[Dict[str, Any]] = []
    customers: List[Dict[str, Any]] = []
    items: List[Dict[str, Any]] = []


@router.post("/accurate-push")
def push_accurate_updates(payload: AccurateSyncPayload, db: Session = Depends(get_db)):
    """
    Ingest live new invoices generated in Accurate software on the Old PC.
    
    Safety & Accuracy Guarantees:
    1. Idempotent: checks bill numbers to guarantee zero duplicate invoices.
    2. Zero interference: Old PC queries SQL Server with WITH (NOLOCK) and pushes outward.
    3. Auto-links real customers and vendors with GSTIN matching.
    4. Automatically creates line items with standard 5% apparel GST.
    """
    # Verify sync security token
    if payload.secret_token != "syncbill_secret_2026":
        raise HTTPException(status_code=401, detail="Invalid sync secret token")

    firm = db.query(Firm).filter(Firm.name.ilike(f"%{payload.firm_name}%")).first()
    if not firm:
        firm = db.query(Firm).first()
    firm_id = firm.id if firm else 2

    invoices_added = 0
    parties_added = 0
    items_added = 0

    # 1. Process new items if provided
    for it_data in payload.items:
        name = it_data.get("name", "").strip()
        if not name:
            continue
        exists = db.query(Item).filter(Item.name.ilike(name)).first()
        if not exists:
            new_item = Item(
                name=name,
                item_code=it_data.get("item_code") or f"ITM-{db.query(Item).count() + 1}",
                hsn_code=it_data.get("hsn_code", "6109"),
                gst_rate=Decimal(str(it_data.get("gst_rate", "5.00"))),
                retail_rate=Decimal(str(it_data.get("retail_rate", "0.00"))),
                purchase_rate=Decimal(str(it_data.get("purchase_rate", "0.00"))),
                current_stock=Decimal(str(it_data.get("current_stock", "100.00"))),
                primary_uom=it_data.get("uom", "Pcs"),
                is_active=True,
            )
            db.add(new_item)
            items_added += 1
    db.commit()

    # 2. Process new parties if provided
    for p_data in payload.customers:
        name = p_data.get("name", "").strip()
        gstin = p_data.get("gstin", "").strip().upper()
        if not name:
            continue
        exists = db.query(Customer).filter((Customer.name.ilike(name)) | (Customer.gstin == gstin if gstin else False)).first()
        if not exists:
            ptype = PartyType.VENDOR if p_data.get("party_type") == "vendor" else PartyType.CUSTOMER
            new_party = Customer(
                name=name,
                gstin=gstin or None,
                party_type=ptype,
                phone=p_data.get("phone"),
                state_code=gstin[:2] if len(gstin) >= 2 else "27",
                opening_balance=Decimal(str(p_data.get("opening_balance", "0.00"))),
                is_active=True,
            )
            db.add(new_party)
            parties_added += 1
    db.commit()

    # 3. Process new invoices
    existing_numbers = set(i.invoice_number for i in db.query(Invoice.invoice_number).all())

    for inv_data in payload.invoices:
        bill_no = str(inv_data.get("bill_no", "")).strip()
        if not bill_no:
            continue

        is_purchase = (inv_data.get("invoice_type", "sales").lower() == "purchase")
        prefix = "PUR-" if is_purchase else "INV-"
        inv_number = f"{prefix}{bill_no}"

        if inv_number in existing_numbers:
            # Already exists in SyncBill, skip to avoid duplicate billing
            continue

        # Find or create party
        party_name = inv_data.get("party_name", "Cash Customer" if not is_purchase else "Cash Supplier").strip()
        party_gstin = inv_data.get("party_gstin", "").strip().upper()
        cust = db.query(Customer).filter(Customer.name.ilike(party_name)).first()
        if not cust and party_gstin:
            cust = db.query(Customer).filter(Customer.gstin == party_gstin).first()
        if not cust:
            cust = Customer(
                name=party_name,
                gstin=party_gstin or None,
                party_type=PartyType.VENDOR if is_purchase else PartyType.CUSTOMER,
                state_code=party_gstin[:2] if len(party_gstin) >= 2 else "27",
                is_active=True,
            )
            db.add(cust)
            db.flush()
            parties_added += 1

        # Parse invoice date
        inv_date = date.today()
        if inv_data.get("date"):
            try:
                inv_date = datetime.strptime(str(inv_data["date"]), "%Y-%m-%d").date()
            except Exception:
                pass

        taxable = Decimal(str(inv_data.get("taxable", "0.00")))
        cgst = Decimal(str(inv_data.get("cgst", "0.00")))
        sgst = Decimal(str(inv_data.get("sgst", "0.00")))
        igst = Decimal(str(inv_data.get("igst", "0.00")))
        roundoff = Decimal(str(inv_data.get("roundoff", "0.00")))
        total = Decimal(str(inv_data.get("total", "0.00")))
        if total == 0:
            total = taxable + cgst + sgst + igst + roundoff

        itype = InvoiceType.PURCHASE if is_purchase else InvoiceType.SALES

        new_inv = Invoice(
            firm_id=firm_id,
            customer_id=cust.id,
            invoice_number=inv_number,
            invoice_type=itype,
            invoice_date=inv_date,
            place_of_supply=cust.state_code or "27",
            subtotal=taxable,
            total_cgst=cgst,
            total_sgst=sgst,
            total_igst=igst,
            total_tax=cgst + sgst + igst,
            round_off=roundoff,
            grand_total=total,
            balance_amount=total,
            payment_status=PaymentStatus.UNPAID,
            notes=f"Auto-synced from Old PC Accurate Software on {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            is_cancelled=False,
        )
        db.add(new_inv)
        db.flush()

        # Add line items if provided, or default single line
        lines = inv_data.get("items", [])
        if lines:
            for l in lines:
                line_qty = Decimal(str(l.get("quantity", "1.000")))
                line_rate = Decimal(str(l.get("rate", "0.00")))
                line_taxable = line_qty * line_rate
                new_item_row = InvoiceItem(
                    invoice_id=new_inv.id,
                    item_name=l.get("name", "Garments / Apparel"),
                    hsn_code=l.get("hsn_code", "6109"),
                    quantity=line_qty,
                    uom=l.get("uom", "Pcs"),
                    rate=line_rate,
                    taxable_amount=line_taxable,
                    gst_rate=Decimal("5.00"),
                    cgst_rate=Decimal("2.50"),
                    cgst_amount=line_taxable * Decimal("0.025"),
                    sgst_rate=Decimal("2.50"),
                    sgst_amount=line_taxable * Decimal("0.025"),
                    total_amount=line_taxable * Decimal("1.05"),
                )
                db.add(new_item_row)
        else:
            default_line = InvoiceItem(
                invoice_id=new_inv.id,
                item_name=f"Apparel Items ({inv_number})",
                hsn_code="6109",
                quantity=Decimal("1.000"),
                uom="Pcs",
                rate=taxable,
                taxable_amount=taxable,
                gst_rate=Decimal("5.00"),
                cgst_rate=Decimal("2.50") if cgst > 0 else Decimal("0.00"),
                cgst_amount=cgst,
                sgst_rate=Decimal("2.50") if sgst > 0 else Decimal("0.00"),
                sgst_amount=sgst,
                igst_rate=Decimal("5.00") if igst > 0 else Decimal("0.00"),
                igst_amount=igst,
                total_amount=total,
            )
            db.add(default_line)

        existing_numbers.add(inv_number)
        invoices_added += 1

    db.commit()

    # Record sync metrics
    LAST_SYNC_STATUS["status"] = "success"
    LAST_SYNC_STATUS["last_sync_time"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    LAST_SYNC_STATUS["last_machine"] = payload.machine_name
    LAST_SYNC_STATUS["invoices_added"] = invoices_added
    LAST_SYNC_STATUS["parties_added"] = parties_added
    LAST_SYNC_STATUS["items_added"] = items_added

    return {
        "status": "success",
        "message": f"Successfully ingested {invoices_added} new invoices, {parties_added} new parties, and {items_added} new items from {payload.machine_name}.",
        "invoices_added": invoices_added,
        "parties_added": parties_added,
        "items_added": items_added,
        "timestamp": datetime.now().isoformat(),
    }


# ── Cloud Relay & Official Accurate .RPT PDF Indexing ─────────────────────────
class PdfIndexItem(BaseModel):
    target_type: str  # "PARTY" or "INVOICE"
    identifier: str   # Party Name or Invoice Number
    drive_id: str
    drive_url: str
    filename: Optional[str] = None


class PdfIndexPayload(BaseModel):
    machine_name: str = "Old-PC"
    items: List[PdfIndexItem]


@router.post("/pdf-index")
def index_official_pdfs(payload: PdfIndexPayload, db: Session = Depends(get_db)):
    """
    Indexes official Accurate Crystal Reports (.rpt) PDFs uploaded by the Old PC
    into Google Drive, directly linking them to the Customer / Vendor or Invoice record.
    """
    indexed_parties = 0
    indexed_invoices = 0
    now = datetime.now(timezone.utc)

    for item in payload.items:
        target = item.target_type.upper()
        if target in ("PARTY", "CUSTOMER", "VENDOR", "LEDGER"):
            cust = None
            ident = item.identifier.strip()
            if ident.isdigit():
                cust = db.query(Customer).filter(Customer.id == int(ident)).first()
            if not cust:
                cust = db.query(Customer).filter(Customer.name.ilike(ident)).first()
            if cust:
                cust.official_pdf_drive_id = item.drive_id
                cust.official_pdf_url = item.drive_url
                cust.pdf_updated_at = now
                indexed_parties += 1

        elif target in ("INVOICE", "BILL", "PURCHASE", "SALE"):
            clean_id = item.identifier.strip()
            inv = db.query(Invoice).filter(
                (Invoice.invoice_number == clean_id) |
                (Invoice.invoice_number == f"PUR-{clean_id}") |
                (Invoice.invoice_number == f"INV-{clean_id}") |
                (Invoice.vendor_bill_number == clean_id)
            ).first()
            if inv:
                inv.official_pdf_drive_id = item.drive_id
                inv.official_pdf_url = item.drive_url
                inv.pdf_updated_at = now
                indexed_invoices += 1

    db.commit()
    return {
        "status": "success",
        "indexed_parties": indexed_parties,
        "indexed_invoices": indexed_invoices,
        "timestamp": now.isoformat()
    }


@router.post("/pull-cloud")
def pull_cloud_updates(payload: Optional[Dict[str, Any]] = None, db: Session = Depends(get_db)):
    """
    Pulls and ingests the latest cloud manifest from Google Drive.
    Allows the laptop to update even when the shop PC is off.
    """
    from app.services.cloud_sync_receiver import ingest_sync_payload
    if not payload:
        # Check local synced folder or return ready state
        return {"status": "ready", "message": "Cloud sync receiver listening. Ready to ingest."}
    return ingest_sync_payload(payload, db)



