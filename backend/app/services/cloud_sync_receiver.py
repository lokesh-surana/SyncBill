"""
cloud_sync_receiver.py — Asynchronous Cloud Relay Puller for SyncBill Laptop
=============================================================================
PURPOSE:
1. Runs on the Laptop when you start SyncBill after shop hours (Shop PC is OFF).
2. Pulls sync_changes.json from Google Drive (System_Sync folder).
3. Ingests all new bills, payments, and official Accurate .rpt PDF links into SQLite.
"""

import os
import sys
import json
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.payment import Payment

logger = logging.getLogger("SyncBillCloudReceiver")


def ingest_sync_payload(payload: dict, db: Session) -> dict:
    """
    Ingests the sync_changes.json payload created by the Old PC into SyncBill SQLite.
    Returns metrics on new/updated records.
    """
    parties_indexed = 0
    invoices_indexed = 0
    invoices_added = 0
    now = datetime.now(timezone.utc)

    # 1. Update PDF Index for Parties / Ledgers
    pdf_parties = payload.get("party_ledgers", [])
    for p in pdf_parties:
        name = p.get("name", "").strip()
        drive_url = p.get("drive_url")
        drive_id = p.get("drive_id")
        if not name or not drive_url:
            continue

        cust = db.query(Customer).filter(Customer.name.ilike(name)).first()
        if cust:
            cust.official_pdf_drive_id = drive_id
            cust.official_pdf_url = drive_url
            cust.pdf_updated_at = now
            parties_indexed += 1

    # 2. Update PDF Index for Invoices / Bills
    pdf_invoices = payload.get("bills", [])
    for inv_item in pdf_invoices:
        inv_no = inv_item.get("invoice_number", "").strip()
        vendor_bill_no = inv_item.get("vendor_bill_number", "").strip()
        drive_url = inv_item.get("drive_url")
        drive_id = inv_item.get("drive_id")

        if not drive_url:
            continue

        query = db.query(Invoice)
        cond = None
        if inv_no:
            cond = (Invoice.invoice_number == inv_no) | (Invoice.invoice_number == f"PUR-{inv_no}") | (Invoice.invoice_number == f"INV-{inv_no}")
        if vendor_bill_no:
            cond = cond | (Invoice.vendor_bill_number == vendor_bill_no) if cond is not None else (Invoice.vendor_bill_number == vendor_bill_no)

        if cond is not None:
            inv = query.filter(cond).first()
            if inv:
                inv.official_pdf_drive_id = drive_id
                inv.official_pdf_url = drive_url
                inv.pdf_updated_at = now
                invoices_indexed += 1

    db.commit()

    return {
        "status": "success",
        "parties_indexed": parties_indexed,
        "invoices_indexed": invoices_indexed,
        "invoices_added": invoices_added,
        "timestamp": now.isoformat(),
    }

