"""
import_all_collections.py — Imports all 1,902 collection vouchers & 510 payment vouchers from Accurate AtechDB into SyncBill.
"""

import json
import re
import datetime
from decimal import Decimal
import os
import sqlite3

from app.database import SessionLocal
from app.models.payment import Payment, PaymentType, PaymentMode
from app.models.customer import Customer
from app.models.invoice import Invoice, PaymentStatus
from app.models.firm import Firm

COLLECTIONS_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "accurate_collections.json")
PAYMENTS_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "accurate_payments.json")

def parse_date(d_str):
    if not d_str:
        return datetime.date.today()
    try:
        return datetime.datetime.strptime(str(d_str)[:10], "%Y-%m-%d").date()
    except Exception:
        return datetime.date.today()

def parse_payment_mode(pay_type, chq_no=""):
    pt = str(pay_type or "").strip().lower()
    chq = str(chq_no or "").strip().lower()
    if "cash" in pt:
        return PaymentMode.CASH
    if "upi" in pt or "upi" in chq:
        return PaymentMode.UPI
    if "cheque" in pt or "chq" in pt:
        return PaymentMode.CHEQUE
    return PaymentMode.BANK_TRANSFER

def extract_bill_numbers(ref_str):
    if not ref_str:
        return []
    # Pattern: Bill No : 51, 106 or Bill No : 259, 260
    m = re.search(r'Bill\s*No\s*:\s*([^,\r\n]+(?:,\s*[^,\r\n]+)*)', ref_str, re.IGNORECASE)
    if not m:
        return []
    raw = m.group(1)
    nums = [x.strip() for x in raw.split(',') if x.strip() and x.strip().lower() != 'opening']
    return nums

def run_import():
    db = SessionLocal()
    print("[1/3] Loading existing parties and invoices into cache...")

    # Load customers cache: normalized_name -> customer_id
    customers = db.query(Customer).all()
    cust_map = {}
    for c in customers:
        norm = c.name.strip().upper()
        cust_map[norm] = c.id

    # Load invoices cache: (firm_id, invoice_number) -> invoice
    invoices = db.query(Invoice).all()
    inv_map = {}
    for inv in invoices:
        inv_map[(inv.firm_id, str(inv.invoice_number).strip().upper())] = inv

    # Load existing payment sync numbers
    existing_pmts = {p.payment_number for p in db.query(Payment.payment_number).all()}

    print(f"  Existing Customers: {len(cust_map)}, Invoices: {len(inv_map)}, Payments: {len(existing_pmts)}")

    print("\n[2/3] Importing Customer Collections (CollectionMaster)...")
    with open(COLLECTIONS_JSON, "r", encoding="utf-8-sig") as f:
        collections = json.load(f)

    coll_imported = 0
    coll_skipped = 0
    bills_settled = 0

    for r in collections:
        code = r.get("CollectionCode")
        pmt_no = f"REC-{code}"
        if pmt_no in existing_pmts:
            coll_skipped += 1
            continue

        raw_cname = str(r.get("CustomerName") or "").strip()
        if not raw_cname:
            continue

        cname_upper = raw_cname.upper()
        # Find or create customer
        cust_id = cust_map.get(cname_upper)
        if not cust_id:
            # Create customer record
            new_cust = Customer(
                name=raw_cname,
                party_type="customer",
                state_code="27",
                opening_balance=Decimal("0.00"),
                is_active=True
            )
            db.add(new_cust)
            db.flush()
            cust_id = new_cust.id
            cust_map[cname_upper] = cust_id

        # Firm mapping from Accurate AtechDB FirmMaster:
        # FirmCode 1 -> APEX APPARELS & TEXTILES (ID 2 in SQLite)
        # FirmCode 2 -> METRO CREATIONS (ID 3 in SQLite)
        raw_firm = int(r.get("FirmCode") or 1)
        firm_id = 3 if raw_firm == 2 else 2

        amount = Decimal(str(r.get("Amount") or 0))
        if amount <= 0:
            continue

        pmt_date = parse_date(r.get("CollectionDate"))
        chq_no = str(r.get("ChqNo") or "").strip()
        ref_bills = str(r.get("RefbillNumbers") or "").strip()
        remarks = str(r.get("Remarks") or "").strip()
        mode = parse_payment_mode(r.get("PayType"), chq_no)

        # Check if matched to invoice
        matched_inv = None
        bill_nums = extract_bill_numbers(ref_bills)
        for bnum in bill_nums:
            inv_key = (firm_id, bnum.upper())
            if inv_key in inv_map:
                matched_inv = inv_map[inv_key]
                break

        pmt = Payment(
            payment_number=pmt_no,
            firm_id=firm_id,
            customer_id=cust_id,
            invoice_id=matched_inv.id if matched_inv else None,
            payment_type=PaymentType.RECEIPT,
            payment_mode=mode,
            amount=amount,
            payment_date=pmt_date,
            reference_number=chq_no or None,
            notes=f"{remarks} | {ref_bills}".strip(" |") if (remarks or ref_bills) else None,
            is_cancelled=False
        )
        db.add(pmt)
        existing_pmts.add(pmt_no)
        coll_imported += 1

        # If matched to invoice, update invoice paid and balance
        if matched_inv:
            new_paid = matched_inv.paid_amount + amount
            matched_inv.paid_amount = new_paid
            new_bal = max(Decimal("0.00"), matched_inv.grand_total - new_paid)
            matched_inv.balance_amount = new_bal
            if new_bal <= 0:
                matched_inv.payment_status = PaymentStatus.PAID
            else:
                matched_inv.payment_status = PaymentStatus.PARTIAL
            bills_settled += 1

    db.commit()
    print(f"  [OK] Collections Imported: {coll_imported}, Skipped (already exist): {coll_skipped}, Bills Settled: {bills_settled}")

    print("\n[3/3] Importing Vendor Payments (PaymentMaster)...")
    with open(PAYMENTS_JSON, "r", encoding="utf-8-sig") as f:
        payments_data = json.load(f)

    pay_imported = 0
    pay_skipped = 0

    for r in payments_data:
        code = r.get("CollectionCode")
        pmt_no = f"PAY-{code}"
        if pmt_no in existing_pmts:
            pay_skipped += 1
            continue

        raw_cname = str(r.get("CustomerName") or "").strip()
        if not raw_cname:
            continue

        cname_upper = raw_cname.upper()
        cust_id = cust_map.get(cname_upper)
        if not cust_id:
            new_cust = Customer(
                name=raw_cname,
                party_type="vendor",
                state_code="27",
                opening_balance=Decimal("0.00"),
                is_active=True
            )
            db.add(new_cust)
            db.flush()
            cust_id = new_cust.id
            cust_map[cname_upper] = cust_id

        # Firm mapping from Accurate AtechDB FirmMaster:
        # FirmCode 1 -> APEX APPARELS & TEXTILES (ID 2 in SQLite)
        # FirmCode 2 -> METRO CREATIONS (ID 3 in SQLite)
        raw_firm = int(r.get("FirmCode") or 1)
        firm_id = 3 if raw_firm == 2 else 2

        amount = Decimal(str(r.get("Amount") or 0))
        if amount <= 0:
            continue

        pmt_date = parse_date(r.get("CollectionDate"))
        chq_no = str(r.get("ChqNo") or "").strip()
        ref_bills = str(r.get("RefbillNumbers") or "").strip()
        remarks = str(r.get("Remarks") or "").strip()
        mode = parse_payment_mode(r.get("PayType"), chq_no)

        pmt = Payment(
            payment_number=pmt_no,
            firm_id=firm_id,
            customer_id=cust_id,
            invoice_id=None,
            payment_type=PaymentType.PAYMENT,
            payment_mode=mode,
            amount=amount,
            payment_date=pmt_date,
            reference_number=chq_no or None,
            notes=f"{remarks} | {ref_bills}".strip(" |") if (remarks or ref_bills) else None,
            is_cancelled=False
        )
        db.add(pmt)
        existing_pmts.add(pmt_no)
        pay_imported += 1

    db.commit()
    print(f"  [OK] Vendor Payments Imported: {pay_imported}, Skipped: {pay_skipped}")

    # Summary
    total_payments = db.query(Payment).count()
    total_amount = db.query(Payment).all()
    inward = sum(p.amount for p in total_amount if p.payment_type == PaymentType.RECEIPT)
    outward = sum(p.amount for p in total_amount if p.payment_type == PaymentType.PAYMENT)
    print(f"\n=======================================================")
    print(f"  Final Database Totals:")
    print(f"  Total Payment Vouchers : {total_payments}")
    print(f"  Customer Receipts IN   : Rs. {inward:,.2f}")
    print(f"  Vendor Payments OUT    : Rs. {outward:,.2f}")
    print(f"=======================================================")
    db.close()

if __name__ == '__main__':
    run_import()
