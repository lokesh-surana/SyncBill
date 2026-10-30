"""
import_all_missing_historical_bills.py — Full Import of Accurate Historical Invoices
==================================================================================
Imports all missing sales bills (BillingMaster - 2,748 bills, ~Rs. 5.59 Cr)
and missing purchase bills (PurchaseMaster - 616 bills, ~Rs. 5.35 Cr) from AtechDB
into SyncBill SQLite, instantly correcting all customer and vendor ledger balances.
"""

import os
import sys
import datetime
import pyodbc
from decimal import Decimal
from sqlalchemy.orm import Session

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "backend"))

from app.database import SessionLocal
from app.models.customer import Customer, PartyType
from app.models.invoice import Invoice, InvoiceItem, InvoiceType, PaymentStatus
from app.models.payment import Payment

def get_fy_code(dt):
    y = dt.year
    if dt.month >= 4:
        return f"{str(y)[2:]}-{str(y+1)[2:]}"
    else:
        return f"{str(y-1)[2:]}-{str(y)[2:]}"

def parse_date(dt_val):
    if not dt_val:
        return datetime.date.today()
    if isinstance(dt_val, datetime.date):
        return dt_val
    if isinstance(dt_val, datetime.datetime):
        return dt_val.date()
    try:
        return datetime.datetime.strptime(str(dt_val)[:10], "%Y-%m-%d").date()
    except Exception:
        return datetime.date.today()

def main():
    print("=" * 70)
    print("  SyncBill ERP — Accurate Historical Invoices & Ledgers Synchronizer")
    print("=" * 70)

    # 1. Connect to AtechDB on SQL Server
    print("\n[1/4] Connecting to Accurate SQL Server (AtechDB)...")
    try:
        sql_conn = pyodbc.connect("DRIVER={SQL Server};SERVER=localhost\\SQLEXPRESS;DATABASE=AtechDB;Trusted_Connection=yes;", timeout=5)
        sql_cur = sql_conn.cursor()
        print("  [OK] Connected to SQL Server AtechDB successfully!")
    except Exception as e:
        print(f"  [ERROR] Could not connect to SQL Server: {e}")
        return

    # 2. Connect to SyncBill SQLite
    db: Session = SessionLocal()

    # Load Customers Cache: normalized_name -> Customer
    customers = db.query(Customer).all()
    cust_map = {}
    for c in customers:
        norm = c.name.strip().upper()
        cust_map[norm] = c

    # Load Invoices Cache: (firm_id, invoice_type, invoice_number) -> Invoice
    existing_invoices = db.query(Invoice).all()
    inv_cache = set()
    for inv in existing_invoices:
        inv_cache.add((inv.firm_id, inv.invoice_type.value if hasattr(inv.invoice_type, 'value') else str(inv.invoice_type), str(inv.invoice_number).strip().upper()))
        if inv.vendor_bill_number:
            inv_cache.add((inv.customer_id, 'PURCHASE', str(inv.vendor_bill_number).strip().upper()))

    print(f"  [OK] Loaded {len(cust_map)} existing parties and {len(existing_invoices)} invoices from SyncBill.")

    # -------------------------------------------------------------
    # 3. IMPORT MISSING PURCHASE BILLS (PurchaseMaster)
    # -------------------------------------------------------------
    print("\n[2/4] Scanning & Importing Missing Purchase Bills (PurchaseMaster)...")
    sql_cur.execute("""
        SELECT PCode, FirmCode, PBillNo, PBillDate, CustomerCode, CustomerName, PAmount, RoundOff, PVatAmt, LrNo, LrDate
        FROM PurchaseMaster
        WHERE PAmount > 0
        ORDER BY PBillDate ASC
    """)
    purchases = sql_cur.fetchall()
    print(f"  Total valid purchase bills in AtechDB: {len(purchases)}")

    purch_added = 0
    purch_skipped = 0

    for r in purchases:
        p_code = r.PCode
        raw_firm = int(r.FirmCode or 1)
        firm_id = 3 if raw_firm == 2 else 2
        p_bill_no = str(r.PBillNo or "").strip()
        bill_dt = parse_date(r.PBillDate)
        cust_name = str(r.CustomerName or "").strip()
        total_amt = Decimal(str(round(r.PAmount or 0, 2)))
        round_off = Decimal(str(round(r.RoundOff or 0, 2)))
        vat_amt = Decimal(str(round(r.PVatAmt or 0, 2)))

        if not cust_name:
            # Look up customer name from CustomerMaster
            if r.CustomerCode:
                sql_cur.execute("SELECT CustomerName FROM CustomerMaster WHERE CustomerCode = ?", (r.CustomerCode,))
                c_row = sql_cur.fetchone()
                if c_row and c_row[0]:
                    cust_name = str(c_row[0]).strip()

        if not cust_name:
            cust_name = "Cash Supplier"

        # Match or create party
        norm_name = cust_name.upper()
        cust_obj = cust_map.get(norm_name)
        if not cust_obj:
            cust_obj = Customer(
                name=cust_name,
                party_type=PartyType.VENDOR,
                is_active=True,
            )
            db.add(cust_obj)
            db.flush()
            cust_map[norm_name] = cust_obj

        # Check deduplication
        inv_no = f"PUR-{p_bill_no}" if p_bill_no and p_bill_no != "0" else f"PUR-ATECH-{p_code}"
        check_key = (firm_id, 'PURCHASE', inv_no.upper())
        vendor_check = (cust_obj.id, 'PURCHASE', p_bill_no.upper()) if p_bill_no and p_bill_no != "0" else None

        if check_key in inv_cache or (vendor_check and vendor_check in inv_cache):
            purch_skipped += 1
            continue

        # Tax calculations (standard 5% GST on apparel)
        taxable = total_amt - vat_amt - round_off
        cgst = vat_amt / Decimal("2.0")
        sgst = vat_amt / Decimal("2.0")

        new_purch = Invoice(
            firm_id=firm_id,
            customer_id=cust_obj.id,
            invoice_number=inv_no,
            invoice_type=InvoiceType.PURCHASE,
            invoice_date=bill_dt,
            place_of_supply=cust_obj.state_code or "27",
            subtotal=taxable,
            total_cgst=cgst,
            total_sgst=sgst,
            total_igst=Decimal("0.00"),
            total_tax=vat_amt,
            round_off=round_off,
            grand_total=total_amt,
            balance_amount=total_amt,
            payment_status=PaymentStatus.UNPAID,
            vendor_bill_number=p_bill_no if p_bill_no != "0" else f"ATECH-{p_code}",
            vendor_bill_date=bill_dt,
            lr_number=str(r.LrNo or "").strip() or None,
            lr_date=parse_date(r.LrDate) if r.LrDate else None,
            notes=f"Historical purchase inward imported from Accurate AtechDB PCode #{p_code}",
            is_cancelled=False,
        )
        db.add(new_purch)
        db.flush()

        # Add single summary item row
        item_row = InvoiceItem(
            invoice_id=new_purch.id,
            item_name=f"Inward Garments / Goods (Bill #{p_bill_no})",
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
            total_amount=total_amt,
        )
        db.add(item_row)

        inv_cache.add(check_key)
        if vendor_check:
            inv_cache.add(vendor_check)
        purch_added += 1

    db.commit()
    print(f"  [DONE] Purchase Bills: +{purch_added} newly imported, {purch_skipped} already existing.")

    # -------------------------------------------------------------
    # 4. IMPORT MISSING SALES BILLS (BillingMaster)
    # -------------------------------------------------------------
    print("\n[3/4] Scanning & Importing Missing Sales Bills (BillingMaster)...")
    sql_cur.execute("""
        SELECT BillNo, FirmCode, BillNumber, BillDate, CustomerCode, CustomerName, Amount, VatAmt, RoundOff, PayType, LrNo, LrDate, NOP
        FROM BillingMaster
        WHERE Amount > 0
        ORDER BY BillDate ASC
    """)
    sales = sql_cur.fetchall()
    print(f"  Total valid sales bills in AtechDB: {len(sales)}")

    sales_added = 0
    sales_skipped = 0

    for r in sales:
        b_no = r.BillNo
        raw_firm = int(r.FirmCode or 1)
        firm_id = 3 if raw_firm == 2 else 2
        bill_number = str(r.BillNumber or b_no).strip()
        bill_dt = parse_date(r.BillDate)
        cust_name = str(r.CustomerName or "").strip()
        total_amt = Decimal(str(round(r.Amount or 0, 2)))
        round_off = Decimal(str(round(r.RoundOff or 0, 2)))
        vat_amt = Decimal(str(round(r.VatAmt or 0, 2)))

        if not cust_name:
            if r.CustomerCode:
                sql_cur.execute("SELECT CustomerName FROM CustomerMaster WHERE CustomerCode = ?", (r.CustomerCode,))
                c_row = sql_cur.fetchone()
                if c_row and c_row[0]:
                    cust_name = str(c_row[0]).strip()

        if not cust_name:
            cust_name = "Cash Customer"

        # Match or create party
        norm_name = cust_name.upper()
        cust_obj = cust_map.get(norm_name)
        if not cust_obj:
            cust_obj = Customer(
                name=cust_name,
                party_type=PartyType.CUSTOMER,
                is_active=True,
            )
            db.add(cust_obj)
            db.flush()
            cust_map[norm_name] = cust_obj

        # Unique Invoice Number incorporating Financial Year
        prefix = "KC" if firm_id == 3 else "SG"
        fy_code = get_fy_code(bill_dt)
        inv_no = f"{prefix}/{fy_code}/{bill_number}"
        check_key = (firm_id, 'SALES', inv_no.upper())
        legacy_key = (firm_id, 'SALES', f"{prefix}-{bill_number}".upper())

        # If already imported under FY-code, legacy-code, or exact match, skip
        if check_key in inv_cache or legacy_key in inv_cache:
            sales_skipped += 1
            continue

        taxable = total_amt - vat_amt - round_off
        cgst = vat_amt / Decimal("2.0")
        sgst = vat_amt / Decimal("2.0")

        new_sale = Invoice(
            firm_id=firm_id,
            customer_id=cust_obj.id,
            invoice_number=inv_no,
            invoice_type=InvoiceType.SALES,
            invoice_date=bill_dt,
            place_of_supply=cust_obj.state_code or "27",
            subtotal=taxable,
            total_cgst=cgst,
            total_sgst=sgst,
            total_igst=Decimal("0.00"),
            total_tax=vat_amt,
            round_off=round_off,
            grand_total=total_amt,
            balance_amount=total_amt,
            payment_status=PaymentStatus.UNPAID,
            lr_number=str(r.LrNo or "").strip() or None,
            lr_date=parse_date(r.LrDate) if r.LrDate else None,
            number_of_parcels=str(int(r.NOP)) if r.NOP else None,
            notes=f"Historical sales invoice imported from Accurate AtechDB BillNo #{b_no}",
            is_cancelled=False,
        )
        db.add(new_sale)
        db.flush()

        # Add single summary item row
        item_row = InvoiceItem(
            invoice_id=new_sale.id,
            item_name=f"Garments / Apparel Items ({inv_no})",
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
            total_amount=total_amt,
        )
        db.add(item_row)

        inv_cache.add(check_key)
        sales_added += 1

    db.commit()
    print(f"  [DONE] Sales Bills: +{sales_added} newly imported, {sales_skipped} already existing.")

    # -------------------------------------------------------------
    # 5. RECONCILIATION AUDIT
    # -------------------------------------------------------------
    print("\n[4/4] Verifying Final Ledger Balances on Key Parties...")
    test_parties = ["DTMS Fashion Apparels Pvt.Ltd", "J K HOSIERY", "VK MART", "R M TRADERS", "SANAS SPORTS WEAR", "KUDU FABRIC"]

    for p_name in test_parties:
        cust = db.query(Customer).filter(Customer.name.ilike(f"%{p_name}%")).first()
        if not cust:
            continue

        is_vendor = (cust.party_type == PartyType.VENDOR)
        invs = db.query(Invoice).filter(Invoice.customer_id == cust.id).all()
        pmts = db.query(Payment).filter(Payment.customer_id == cust.id).all()

        tot_purch = sum(float(i.grand_total) for i in invs if i.invoice_type == InvoiceType.PURCHASE)
        tot_sales = sum(float(i.grand_total) for i in invs if i.invoice_type == InvoiceType.SALES)
        tot_pmts = sum(float(p.amount) for p in pmts if p.payment_type.value == 'PAYMENT' or p.payment_type == 'payment')
        tot_rcpts = sum(float(p.amount) for p in pmts if p.payment_type.value == 'RECEIPT' or p.payment_type == 'receipt')

        if is_vendor:
            net_bal = tot_pmts - tot_purch
            sign = "Dr (Advance)" if net_bal > 0 else ("Cr (Payable)" if net_bal < 0 else "Settled")
            print(f"  Vendor: {cust.name[:30]:<30} | Purchases: Rs.{tot_purch:>12,.2f} | Payments: Rs.{tot_pmts:>12,.2f} | Balance: Rs.{abs(net_bal):>10,.2f} {sign}")
        else:
            net_bal = tot_sales - tot_rcpts
            sign = "Dr (Due)" if net_bal > 0 else ("Cr (Advance)" if net_bal < 0 else "Settled")
            print(f"  Cust  : {cust.name[:30]:<30} | Sales    : Rs.{tot_sales:>12,.2f} | Receipts: Rs.{tot_rcpts:>12,.2f} | Balance: Rs.{abs(net_bal):>10,.2f} {sign}")

    print("\n" + "=" * 70)
    print(f"  SUCCESS! Total Newly Imported: {purch_added} Purchases, {sales_added} Sales.")
    print("=" * 70)

if __name__ == "__main__":
    main()
