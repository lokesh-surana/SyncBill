"""
Export all customer/vendor ledgers and invoices into a designated folder
synced to OneDrive / Google Drive so you have 24/7 mobile access without keeping any PC on.
"""

import os
import sys
import datetime
import re

_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_ROOT, "backend"))

from app.database import SessionLocal
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceType
from app.routers.reports import get_party_ledger
from app.routers.invoices import print_invoice_html

EXPORT_DIR = os.path.join(_ROOT, "SyncBill_Cloud_PDFs")
LEDGERS_CUST_DIR = os.path.join(EXPORT_DIR, "Customer_Ledgers")
LEDGERS_VEND_DIR = os.path.join(EXPORT_DIR, "Vendor_Ledgers")
SALES_DIR = os.path.join(EXPORT_DIR, "Sales_Invoices")
PURCHASE_DIR = os.path.join(EXPORT_DIR, "Purchase_Bills")

for d in [LEDGERS_CUST_DIR, LEDGERS_VEND_DIR, SALES_DIR, PURCHASE_DIR]:
    os.makedirs(d, exist_ok=True)

def sanitize_filename(name):
    return re.sub(r'[\\/*?:"<>| ]', '_', str(name or ''))

def export_party_ledger_html(party, db):
    try:
        data = get_party_ledger(customer_id=party.id, firm_id='all', db=db)
    except Exception as e:
        return False

    is_vend = (party.party_type or '').lower() == 'vendor'
    folder = LEDGERS_VEND_DIR if is_vend else LEDGERS_CUST_DIR
    filename = f"{sanitize_filename(party.name)}_Ledger.html"
    filepath = os.path.join(folder, filename)

    tx_rows = ""
    for tx in data.get("transactions", []):
        tx_rows += f"""
        <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">{tx['date']}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">{tx['voucher_type']}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">{tx['voucher_no']}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">{tx['narration']}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0284c7;">{f"₹ {tx['debit']:,.2f}" if tx['debit'] > 0 else "-"}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #16a34a;">{f"₹ {tx['credit']:,.2f}" if tx['credit'] > 0 else "-"}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">₹ {tx['running_balance']:,.2f} {tx['balance_type']}</td>
        </tr>
        """

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{party.name} — Statement of Account</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20px; color: #1e293b; background: #fff; }}
        .header {{ border-bottom: 2px solid #0f2b48; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; }}
        .title {{ font-size: 20px; font-weight: 800; color: #0f2b48; margin: 0; }}
        .meta {{ font-size: 13px; color: #475569; margin-top: 4px; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 10px; }}
        th {{ background: #f1f5f9; color: #0f2b48; font-weight: 700; text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 11px; }}
        .summary {{ display: flex; gap: 12px; margin-bottom: 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; }}
        .summary-box {{ flex: 1; }}
        .summary-box span {{ font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; }}
        .summary-box div {{ font-size: 16px; font-weight: 800; margin-top: 2px; }}
        @media print {{ .no-print {{ display: none; }} body {{ margin: 0; }} }}
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 12px; text-align: right;">
        <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 6px 14px; border-radius: 4px; font-weight: 700; cursor: pointer;">🖨️ Print / Save as PDF</button>
    </div>

    <div class="header">
        <div>
            <h1 class="title">{party.name}</h1>
            <div class="meta">
                <span>GSTIN: <strong>{party.gstin or 'Unregistered'}</strong></span> • 
                <span>Address: <strong>{party.billing_address or 'Local'}</strong></span> • 
                <span>Phone: <strong>{party.phone or '-'}</strong></span>
            </div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
            <div style="font-size: 15px; font-weight: 800; color: #0f2b48;">STATEMENT OF ACCOUNT</div>
            <div>Date Generated: {datetime.date.today().strftime('%d/%m/%Y')}</div>
        </div>
    </div>

    <div class="summary">
        <div class="summary-box">
            <span>Opening Balance</span>
            <div style="color: #475569;">₹ {data['opening_balance']:,.2f} {data['opening_balance_type']}</div>
        </div>
        <div class="summary-box">
            <span>Total Debits (+Dr)</span>
            <div style="color: #0284c7;">₹ {data['total_debit']:,.2f}</div>
        </div>
        <div class="summary-box">
            <span>Total Credits (-Cr)</span>
            <div style="color: #16a34a;">₹ {data['total_credit']:,.2f}</div>
        </div>
        <div class="summary-box">
            <span>Net Closing Balance</span>
            <div style="color: {'#c2410c' if data['closing_balance_type'] == 'Dr' else '#15803d'};">₹ {data['closing_balance']:,.2f} {data['closing_balance_type']}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 95px;">Date</th>
                <th style="width: 140px;">Voucher Type</th>
                <th style="width: 150px;">Voucher No</th>
                <th>Narration</th>
                <th style="text-align: right; width: 110px;">Debit (₹)</th>
                <th style="text-align: right; width: 110px;">Credit (₹)</th>
                <th style="text-align: right; width: 125px;">Balance (₹)</th>
            </tr>
        </thead>
        <tbody>
            {tx_rows}
        </tbody>
    </table>
</body>
</html>"""

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    return True

def export_all():
    db = SessionLocal()
    parties = db.query(Customer).filter(Customer.is_active == True).all()
    print(f"Exporting ledgers for {len(parties)} parties to {EXPORT_DIR}...")
    count = 0
    for p in parties:
        if export_party_ledger_html(p, db):
            count += 1
    print(f"Successfully generated {count} party statements ready for mobile & 24/7 access!")

if __name__ == "__main__":
    export_all()

