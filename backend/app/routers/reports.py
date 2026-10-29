from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import date

from app.database import get_db
from app.models.firm import Firm
from app.models.customer import Customer
from app.models.item import Item
from app.models.invoice import Invoice, InvoiceItem, InvoiceType
from app.models.payment import Payment, PaymentMode, PaymentType

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


@router.get("/dashboard")
def get_dashboard_kpis(
    firm_id: int = Query(..., description="Firm ID to generate KPI summary for"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Get executive business KPIs:
    - Total Sales & Tax Collected
    - Total Cash, UPI, and Bank collections
    - Outstanding customer receivables
    - Low stock alerts count
    """
    firm = db.query(Firm).filter(Firm.id == firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail=f"Firm {firm_id} not found.")

    inv_query = db.query(Invoice).filter(
        Invoice.firm_id == firm_id,
        Invoice.invoice_type == InvoiceType.SALES,
        Invoice.is_cancelled == False,
    )
    pmt_query = db.query(Payment).filter(
        Payment.firm_id == firm_id,
        Payment.payment_type == PaymentType.RECEIPT,
        Payment.is_cancelled == False,
    )

    if start_date:
        inv_query = inv_query.filter(Invoice.invoice_date >= start_date)
        pmt_query = pmt_query.filter(Payment.payment_date >= start_date)
    if end_date:
        inv_query = inv_query.filter(Invoice.invoice_date <= end_date)
        pmt_query = pmt_query.filter(Payment.payment_date <= end_date)

    invoices = inv_query.all()
    payments = pmt_query.all()

    total_sales = sum(inv.grand_total for inv in invoices) if invoices else Decimal("0.00")
    total_tax = sum(inv.total_tax for inv in invoices) if invoices else Decimal("0.00")

    cash_collected = sum(p.amount for p in payments if p.payment_mode == PaymentMode.CASH)
    upi_collected = sum(p.amount for p in payments if p.payment_mode == PaymentMode.UPI)
    bank_collected = sum(
        p.amount for p in payments if p.payment_mode in (PaymentMode.BANK_TRANSFER, PaymentMode.CHEQUE)
    )
    total_collected = cash_collected + upi_collected + bank_collected

    # Net Outstanding Receivables across invoices
    total_receivables = sum(inv.balance_amount for inv in invoices) if invoices else Decimal("0.00")

    # Low stock alert items
    low_stock_count = (
        db.query(Item)
        .filter(Item.is_active == True, Item.current_stock <= Item.reorder_level)
        .count()
    )

    return {
        "firm_name": firm.name,
        "gstin": firm.gstin,
        "total_sales": float(total_sales),
        "total_tax_collected": float(total_tax),
        "total_collected": float(total_collected),
        "total_receivables": float(total_receivables),
        "cash_collected": float(cash_collected),
        "upi_collected": float(upi_collected),
        "bank_collected": float(bank_collected),
        "invoices_count": len(invoices),
        "low_stock_items_count": low_stock_count,
    }


@router.get("/gstr1")
def get_gstr1_report(
    firm_id: int = Query(...),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """
    GSTR-1 Compliant Indian Tax Summary:
    - B2B (Invoices with registered Customer GSTIN)
    - B2C (Invoices without Customer GSTIN - retail consumers)
    - HSN-wise tax breakdown summary
    """
    firm = db.query(Firm).filter(Firm.id == firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail=f"Firm {firm_id} not found.")

    query = db.query(Invoice).filter(
        Invoice.firm_id == firm_id,
        Invoice.invoice_type == InvoiceType.SALES,
        Invoice.is_cancelled == False,
    )
    if start_date:
        query = query.filter(Invoice.invoice_date >= start_date)
    if end_date:
        query = query.filter(Invoice.invoice_date <= end_date)

    invoices = query.all()

    b2b_list = []
    b2c_list = []
    hsn_map: Dict[str, Dict[str, Any]] = {}

    for inv in invoices:
        cust = inv.customer
        is_b2b = bool(cust.gstin and len(cust.gstin.strip()) == 15)

        inv_summary = {
            "invoice_number": inv.invoice_number,
            "invoice_date": str(inv.invoice_date),
            "customer_name": cust.name,
            "customer_gstin": cust.gstin,
            "place_of_supply": inv.place_of_supply,
            "taxable_value": float(inv.subtotal),
            "cgst": float(inv.total_cgst),
            "sgst": float(inv.total_sgst),
            "igst": float(inv.total_igst),
            "grand_total": float(inv.grand_total),
        }

        if is_b2b:
            b2b_list.append(inv_summary)
        else:
            b2c_list.append(inv_summary)

        # HSN breakdown aggregation
        for line in inv.items:
            hsn = line.hsn_code or "UNSPECIFIED"
            if hsn not in hsn_map:
                hsn_map[hsn] = {
                    "hsn_code": hsn,
                    "uom": line.uom,
                    "total_quantity": Decimal("0.000"),
                    "taxable_value": Decimal("0.00"),
                    "cgst_amount": Decimal("0.00"),
                    "sgst_amount": Decimal("0.00"),
                    "igst_amount": Decimal("0.00"),
                    "total_tax": Decimal("0.00"),
                }
            hsn_map[hsn]["total_quantity"] += line.quantity
            hsn_map[hsn]["taxable_value"] += line.taxable_amount
            hsn_map[hsn]["cgst_amount"] += line.cgst_amount
            hsn_map[hsn]["sgst_amount"] += line.sgst_amount
            hsn_map[hsn]["igst_amount"] += line.igst_amount
            hsn_map[hsn]["total_tax"] += (line.cgst_amount + line.sgst_amount + line.igst_amount)

    hsn_summary_list = [
        {
            "hsn_code": v["hsn_code"],
            "uom": v["uom"],
            "total_quantity": float(v["total_quantity"]),
            "total_qty": float(v["total_quantity"]),
            "taxable_value": float(v["taxable_value"]),
            "cgst_amount": float(v["cgst_amount"]),
            "sgst_amount": float(v["sgst_amount"]),
            "igst_amount": float(v["igst_amount"]),
            "total_tax": float(v["total_tax"]),
        }
        for v in hsn_map.values()
    ]

    return {
        "firm_name": firm.name,
        "firm_gstin": firm.gstin,
        "b2b": b2b_list,
        "b2b_invoices": b2b_list,
        "b2c": b2c_list,
        "b2c_invoices": b2c_list,
        "hsn_summary": hsn_summary_list,
        "totals": {
            "b2b_count": len(b2b_list),
            "b2c_count": len(b2c_list),
            "total_invoices": len(invoices),
        },
    }


@router.get("/gstr3b")
def get_gstr3b_report(
    firm_id: int = Query(...),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """
    GSTR-3B Monthly Consolidated Summary & Tax Liability:
    - Table 3.1: Details of Outward Taxable Supplies (Sales)
    - Table 4: Eligible Input Tax Credit (ITC from Purchase Bills)
    - Table 5: Net Tax Payable in Cash = (Outward Tax - Eligible ITC)
    - Inward Supplies Register (GSTR-2B preview for CA audit)
    """
    firm = db.query(Firm).filter(Firm.id == firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail=f"Firm {firm_id} not found.")

    # 1. Outward Supplies (Sales)
    sales_query = db.query(Invoice).filter(
        Invoice.firm_id == firm_id,
        Invoice.invoice_type == InvoiceType.SALES,
        Invoice.is_cancelled == False,
    )
    if start_date:
        sales_query = sales_query.filter(Invoice.invoice_date >= start_date)
    if end_date:
        sales_query = sales_query.filter(Invoice.invoice_date <= end_date)

    sales_invoices = sales_query.all()

    outward_taxable = sum(inv.subtotal for inv in sales_invoices) if sales_invoices else Decimal("0.00")
    outward_cgst = sum(inv.total_cgst for inv in sales_invoices) if sales_invoices else Decimal("0.00")
    outward_sgst = sum(inv.total_sgst for inv in sales_invoices) if sales_invoices else Decimal("0.00")
    outward_igst = sum(inv.total_igst for inv in sales_invoices) if sales_invoices else Decimal("0.00")
    outward_total_tax = sum(inv.total_tax for inv in sales_invoices) if sales_invoices else Decimal("0.00")

    # 2. Inward Supplies (Purchases - Eligible ITC)
    purchase_query = db.query(Invoice).filter(
        Invoice.firm_id == firm_id,
        Invoice.invoice_type == InvoiceType.PURCHASE,
        Invoice.is_cancelled == False,
    )
    if start_date:
        purchase_query = purchase_query.filter(Invoice.invoice_date >= start_date)
    if end_date:
        purchase_query = purchase_query.filter(Invoice.invoice_date <= end_date)

    purchase_invoices = purchase_query.all()

    itc_taxable = sum(inv.subtotal for inv in purchase_invoices) if purchase_invoices else Decimal("0.00")
    itc_cgst = sum(inv.total_cgst for inv in purchase_invoices) if purchase_invoices else Decimal("0.00")
    itc_sgst = sum(inv.total_sgst for inv in purchase_invoices) if purchase_invoices else Decimal("0.00")
    itc_igst = sum(inv.total_igst for inv in purchase_invoices) if purchase_invoices else Decimal("0.00")
    itc_total = sum(inv.total_tax for inv in purchase_invoices) if purchase_invoices else Decimal("0.00")

    # Inward bills breakdown for GSTR-2B verification
    inward_list = []
    for inv in purchase_invoices:
        cust = inv.customer
        inward_list.append({
            "bill_number": inv.invoice_number,
            "bill_date": str(inv.invoice_date),
            "supplier_name": cust.name if cust else "Unknown Supplier",
            "supplier_gstin": (cust.gstin if cust else "") or "Unregistered",
            "taxable_value": float(inv.subtotal),
            "cgst": float(inv.total_cgst),
            "sgst": float(inv.total_sgst),
            "igst": float(inv.total_igst),
            "total_tax": float(inv.total_tax),
            "grand_total": float(inv.grand_total),
        })

    # 3. Net Tax Payable Calculation
    net_cgst = max(Decimal("0.00"), outward_cgst - itc_cgst)
    net_sgst = max(Decimal("0.00"), outward_sgst - itc_sgst)
    net_igst = max(Decimal("0.00"), outward_igst - itc_igst)
    net_total = net_cgst + net_sgst + net_igst

    return {
        "firm_name": firm.name,
        "firm_gstin": firm.gstin,
        "period": {
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None,
        },
        "table_3_1_outward": {
            "title": "3.1 Details of Outward Supplies (Sales Liability)",
            "taxable_value": float(outward_taxable),
            "cgst": float(outward_cgst),
            "sgst": float(outward_sgst),
            "igst": float(outward_igst),
            "total_tax": float(outward_total_tax),
            "invoice_count": len(sales_invoices),
        },
        "table_4_itc": {
            "title": "4. Eligible Input Tax Credit (ITC from Purchases)",
            "taxable_value": float(itc_taxable),
            "cgst": float(itc_cgst),
            "sgst": float(itc_sgst),
            "igst": float(itc_igst),
            "total_tax": float(itc_total),
            "bill_count": len(purchase_invoices),
        },
        "net_tax_payable": {
            "cgst": float(net_cgst),
            "sgst": float(net_sgst),
            "igst": float(net_igst),
            "total": float(net_total),
        },
        "inward_bills": inward_list,
    }


@router.get("/stock-summary")
def get_stock_summary(db: Session = Depends(get_db)):
    """Inventory Stock Valuation Summary for CA Balance Sheet / Audit."""
    items = db.query(Item).filter(Item.is_active == True).order_by(Item.name.asc()).all()
    
    total_qty = Decimal("0.000")
    total_purchase_val = Decimal("0.00")
    total_retail_val = Decimal("0.00")
    item_rows = []

    for it in items:
        qty = it.current_stock or Decimal("0.000")
        prate = it.purchase_rate or Decimal("0.00")
        rrate = it.retail_rate or Decimal("0.00")
        val = qty * prate
        ret_val = qty * rrate

        total_qty += qty
        total_purchase_val += val
        total_retail_val += ret_val

        item_rows.append({
            "id": it.id,
            "item_code": it.item_code,
            "name": it.name,
            "hsn_code": it.hsn_code or "6109",
            "uom": it.primary_uom,
            "current_stock": float(qty),
            "purchase_rate": float(prate),
            "retail_rate": float(rrate),
            "valuation_amount": float(val),
            "retail_valuation": float(ret_val),
            "is_low_stock": qty <= it.reorder_level,
        })

    return {
        "total_items_count": len(items),
        "total_stock_quantity": float(total_qty),
        "total_stock_valuation": float(total_purchase_val),
        "total_retail_valuation": float(total_retail_val),
        "items": item_rows,
    }


@router.get("/low-stock")
def get_low_stock_report(db: Session = Depends(get_db)):
    """Fetch items that have fallen below their reorder thresholds."""
    items = (
        db.query(Item)
        .filter(Item.is_active == True, Item.current_stock <= Item.reorder_level)
        .order_by(Item.current_stock.asc())
        .all()
    )
    return [
        {
            "id": it.id,
            "name": it.name,
            "item_code": it.item_code,
            "current_stock": float(it.current_stock),
            "reorder_level": float(it.reorder_level),
            "primary_uom": it.primary_uom,
            "retail_rate": float(it.retail_rate),
        }
        for it in items
    ]


# ══════════════════════════════════════════════════════════════════════════════
# 📖 PARTY LEDGER & STATEMENT OF ACCOUNT (Khata / A4 Statement)
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/ledger")
def get_party_ledger(
    customer_id: int = Query(..., description="Party ID (Customer or Vendor) to generate statement for"),
    firm_id: Optional[Any] = Query(None, description="Optional Firm ID filter or 'all'"),
    start_date: Optional[date] = Query(None, description="Start date for statement period"),
    end_date: Optional[date] = Query(None, description="End date for statement period"),
    db: Session = Depends(get_db),
):
    """
    Generate an authentic Indian ERP Party Ledger (Statement of Account).
    
    How this works:
    1. Loads the Party record (Name, GSTIN, Opening Balance).
    2. Calculates the 'Opening Balance as on Start Date' by summing past transactions.
    3. Fetches all Sales Bills, Purchase Bills, and Payments in the period.
    4. Merges and sorts every transaction in exact chronological order.
    5. Calculates line-by-line Debit, Credit, and Running Balance.
    """
    # Step 1: Look up the customer/vendor in our database
    if not isinstance(start_date, date):
        if isinstance(start_date, str) and start_date.strip():
            start_date = date.fromisoformat(start_date.strip())
        else:
            start_date = None

    if not isinstance(end_date, date):
        if isinstance(end_date, str) and end_date.strip():
            end_date = date.fromisoformat(end_date.strip())
        else:
            end_date = None

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Party with ID {customer_id} not found.")

    # Step 2: Query all invoices and payments for this party
    inv_query = db.query(Invoice).options(joinedload(Invoice.firm)).filter(
        Invoice.customer_id == customer_id,
        Invoice.is_cancelled == False,
    )
    pmt_query = db.query(Payment).options(joinedload(Payment.firm)).filter(
        Payment.customer_id == customer_id,
        Payment.is_cancelled == False,
    )

    # Optional: Filter by specific firm (e.g. APEX APPARELS & TEXTILES or METRO CREATIONS)
    if firm_id and str(firm_id).lower() != 'all':
        try:
            f_id = int(firm_id)
            inv_query = inv_query.filter(Invoice.firm_id == f_id)
            pmt_query = pmt_query.filter(Payment.firm_id == f_id)
        except (ValueError, TypeError):
            pass

    all_invoices = inv_query.all()
    all_payments = pmt_query.all()

    # Step 3: Calculate the Opening Balance as on the Start Date
    # If the user selected a start date, we must add up all transactions before that date!
    base_opening = customer.opening_balance or Decimal("0.00")
    pre_period_balance = Decimal("0.00")

    period_invoices = []
    for inv in all_invoices:
        if start_date and inv.invoice_date < start_date:
            # Past transaction before the selected date range
            if inv.invoice_type == InvoiceType.SALES:
                pre_period_balance += inv.grand_total  # Customer owed us money
            elif inv.invoice_type == InvoiceType.PURCHASE:
                pre_period_balance -= inv.grand_total  # We owed supplier money
            elif inv.invoice_type == InvoiceType.CREDIT_NOTE:
                pre_period_balance -= inv.grand_total  # Sales return reduces customer debt
            elif inv.invoice_type == InvoiceType.DEBIT_NOTE:
                pre_period_balance += inv.grand_total  # Purchase return reduces supplier liability
        elif (not start_date or inv.invoice_date >= start_date) and (not end_date or inv.invoice_date <= end_date):
            # Current transaction inside our report date range
            period_invoices.append(inv)

    period_payments = []
    for pmt in all_payments:
        if start_date and pmt.payment_date < start_date:
            # Past payment before the selected date range
            if pmt.payment_type == PaymentType.RECEIPT:
                pre_period_balance -= pmt.amount  # Customer paid us, reduced balance
            elif pmt.payment_type == PaymentType.PAYMENT:
                pre_period_balance += pmt.amount  # We paid supplier, reduced what we owed
        elif (not start_date or pmt.payment_date >= start_date) and (not end_date or pmt.payment_date <= end_date):
            # Current payment inside our report date range
            period_payments.append(pmt)

    # Final opening balance at the start of this statement period
    effective_opening = base_opening + pre_period_balance

    # Step 4: Build a unified list of transactions
    transactions = []

    # Add Sales, Purchases, Credit Notes, and Debit Notes
    for inv in period_invoices:
        if inv.invoice_type == InvoiceType.SALES:
            debit_val = float(inv.grand_total)
            credit_val = 0.0
            v_title = "Sales Bill"
            narration = "Sales Tax Invoice"
        elif inv.invoice_type == InvoiceType.PURCHASE:
            debit_val = 0.0
            credit_val = float(inv.grand_total)
            v_title = "Purchase Bill"
            narration = "Purchase Bill / Inward Voucher"
        elif inv.invoice_type == InvoiceType.CREDIT_NOTE:
            debit_val = 0.0
            credit_val = float(inv.grand_total)
            v_title = "Credit Note (Sale Return)"
            narration = f"Sales Return against Bill #{inv.original_invoice_number or 'Direct'}"
            if inv.return_reason:
                narration += f" [{inv.return_reason}]"
        elif inv.invoice_type == InvoiceType.DEBIT_NOTE:
            debit_val = float(inv.grand_total)
            credit_val = 0.0
            v_title = "Debit Note (Purchase Return)"
            narration = f"Purchase Return against Bill #{inv.original_invoice_number or 'Direct'}"
            if inv.return_reason:
                narration += f" [{inv.return_reason}]"
        else:
            debit_val = float(inv.grand_total)
            credit_val = 0.0
            v_title = inv.invoice_type.value.title()
            narration = f"Invoice ({inv.invoice_type.value.upper()})"

        transactions.append({
            "id": f"INV-{inv.id}",
            "raw_date": inv.invoice_date,
            "date": inv.invoice_date.strftime("%d/%m/%Y"),
            "voucher_type": v_title,
            "voucher_no": inv.invoice_number or f"BILL-{inv.id}",
            "narration": narration,
            "firm_id": inv.firm_id,
            "firm_name": inv.firm.name if inv.firm else "Firm",
            "debit": debit_val,
            "credit": credit_val,
        })

    # Add Cash / Bank Payments & Receipts
    for pmt in period_payments:
        is_receipt = (pmt.payment_type == PaymentType.RECEIPT)
        debit_val = float(pmt.amount) if not is_receipt else 0.0
        credit_val = float(pmt.amount) if is_receipt else 0.0
        mode_label = (pmt.payment_mode.value.upper() if hasattr(pmt.payment_mode, 'value') else str(pmt.payment_mode).upper())
        v_title = f"Receipt ({mode_label})" if is_receipt else f"Payment ({mode_label})"

        ref = f" - Ref: {pmt.reference_number}" if pmt.reference_number else ""
        transactions.append({
            "id": f"PMT-{pmt.id}",
            "raw_date": pmt.payment_date,
            "date": pmt.payment_date.strftime("%d/%m/%Y"),
            "voucher_type": v_title,
            "voucher_no": pmt.payment_number,
            "narration": f"{'Received from' if is_receipt else 'Paid to'} party{ref}",
            "firm_id": pmt.firm_id,
            "firm_name": pmt.firm.name if pmt.firm else "Firm",
            "debit": debit_val,
            "credit": credit_val,
        })

    # Step 5: Sort chronologically by date
    transactions.sort(key=lambda t: (t["raw_date"], t["id"]))

    # Step 6: Compute running balance line-by-line
    running_balance = float(effective_opening)
    total_debit = 0.0
    total_credit = 0.0

    for item in transactions:
        total_debit += item["debit"]
        total_credit += item["credit"]
        # In Indian accounting: Debit increases receivable balance, Credit decreases it
        running_balance += (item["debit"] - item["credit"])
        item["running_balance"] = round(abs(running_balance), 2)
        item["balance_type"] = "Dr" if running_balance > 0.01 else ("Cr" if running_balance < -0.01 else "NIL")

    closing_balance = round(abs(running_balance), 2)
    closing_type = "Dr" if running_balance > 0.01 else ("Cr" if running_balance < -0.01 else "NIL")
    opening_type = "Dr" if effective_opening > 0.01 else ("Cr" if effective_opening < -0.01 else "NIL")

    return {
        "party": {
            "id": customer.id,
            "name": customer.name,
            "gstin": customer.gstin,
            "phone": customer.phone,
            "party_type": customer.party_type.value if hasattr(customer.party_type, 'value') else str(customer.party_type),
            "billing_address": customer.billing_address,
            "state_code": customer.state_code or "27",
        },
        "period": {
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None,
        },
        "opening_balance": round(float(abs(effective_opening)), 2),
        "opening_balance_type": opening_type,
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "closing_balance": closing_balance,
        "closing_balance_type": closing_type,
        "net_balance_signed": round(running_balance, 2),
        "transactions_count": len(transactions),
        "transactions": transactions,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 💰 PENDING RECEIVABLES SUMMARY (Market Dues / Udhaari by Party)
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/receivables")
def get_pending_receivables(
    firm_id: Optional[int] = Query(None, description="Optional Firm ID filter"),
    db: Session = Depends(get_db),
):
    """
    Fetch all customer accounts that have pending unpaid balances (Udhaari).
    Groups unpaid sales invoices by customer so the cashier sees exactly who owes what.
    """
    inv_query = db.query(Invoice).options(joinedload(Invoice.customer)).filter(
        Invoice.invoice_type == InvoiceType.SALES,
        Invoice.is_cancelled == False,
        Invoice.balance_amount > 0,
    )
    if firm_id and str(firm_id).lower() != "all":
        inv_query = inv_query.filter(Invoice.firm_id == firm_id)

    invoices = inv_query.order_by(Invoice.invoice_date.desc()).all()

    # Aggregate unpaid balances per customer
    parties_map = {}
    for inv in invoices:
        cid = inv.customer_id
        if cid not in parties_map:
            party_name = inv.customer.name if inv.customer else "Cash Customer"
            parties_map[cid] = {
                "customer_id": cid,
                "party_id": cid,
                "name": party_name,
                "party_name": party_name,
                "gstin": inv.customer.gstin if inv.customer else None,
                "phone": inv.customer.phone if inv.customer else None,
                "total_pending": Decimal("0.00"),
                "balance": Decimal("0.00"),
                "unpaid_invoices_count": 0,
                "last_bill_date": inv.invoice_date,
                "bills": [],
            }
        parties_map[cid]["total_pending"] += inv.balance_amount
        parties_map[cid]["balance"] += inv.balance_amount
        parties_map[cid]["unpaid_invoices_count"] += 1
        parties_map[cid]["bills"].append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date.strftime("%d/%m/%Y") if inv.invoice_date else "-",
            "grand_total": float(inv.grand_total),
            "paid_amount": float(inv.paid_amount),
            "balance_amount": float(inv.balance_amount),
            "payment_status": str(inv.payment_status.value if hasattr(inv.payment_status, "value") else inv.payment_status),
        })
        if inv.invoice_date and (not parties_map[cid]["last_bill_date"] or inv.invoice_date > parties_map[cid]["last_bill_date"]):
            parties_map[cid]["last_bill_date"] = inv.invoice_date

    # Sort from highest debtor to lowest
    sorted_parties = sorted(parties_map.values(), key=lambda p: p["total_pending"], reverse=True)
    total_due = sum(p["total_pending"] for p in sorted_parties)

    return {
        "total_receivables": float(total_due),
        "parties_count": len(sorted_parties),
        "parties": [
            {
                "customer_id": p["customer_id"],
                "party_id": p["party_id"],
                "name": p["name"],
                "party_name": p["party_name"],
                "gstin": p["gstin"],
                "phone": p["phone"],
                "total_pending": float(p["total_pending"]),
                "balance": float(p["balance"]),
                "unpaid_invoices_count": p["unpaid_invoices_count"],
                "last_bill_date": p["last_bill_date"].strftime("%d/%m/%Y") if p["last_bill_date"] else "-",
                "bills": p["bills"],
            }
            for p in sorted_parties
        ]
    }


@router.get("/daybook")
def get_daybook_report(
    firm_id: Optional[Any] = Query(None, description="Firm ID or 'all' for multi-firm combined"),
    target_date: Optional[Any] = Query(None, description="Date for daybook (YYYY-MM-DD), defaults to today"),
    db: Session = Depends(get_db),
):
    """
    Accurate ERP Daybook (Daily Cash, Bank, and Udhaari Register).
    Tracks all transactions that took place on a single business day:
    - Cash Collections & Cash Sales (+Inflow)
    - UPI, Card & Bank Collections (+Inflow)
    - Credit Sales (उधारी माल बिक्री)
    - Supplier Payments & Outward Purchases (-Outflow)
    - Net In-Hand Cash Delta
    """
    if not isinstance(target_date, date):
        if isinstance(target_date, str) and target_date.strip():
            try:
                target_date = date.fromisoformat(target_date.strip())
            except Exception:
                target_date = date.today()
        else:
            target_date = date.today()

    inv_q = db.query(Invoice).options(
        joinedload(Invoice.firm),
        joinedload(Invoice.customer)
    ).filter(
        Invoice.invoice_date == target_date,
        Invoice.is_cancelled == False
    )

    pmt_q = db.query(Payment).options(
        joinedload(Payment.firm),
        joinedload(Payment.customer)
    ).filter(
        Payment.payment_date == target_date,
        Payment.is_cancelled == False
    )

    if firm_id and str(firm_id).lower() != 'all':
        inv_q = inv_q.filter(Invoice.firm_id == int(firm_id))
        pmt_q = pmt_q.filter(Payment.firm_id == int(firm_id))

    day_invoices = inv_q.all()
    day_payments = pmt_q.all()

    cash_inflows = Decimal("0.00")
    bank_inflows = Decimal("0.00")
    credit_sales = Decimal("0.00")
    cash_outflows = Decimal("0.00")
    bank_outflows = Decimal("0.00")

    entries = []

    # Process Invoices
    for inv in day_invoices:
        cust_name = inv.customer.name if inv.customer else "Counter Cash Customer"
        f_name = inv.firm.name if inv.firm else ""
        inv_type = inv.invoice_type.value if hasattr(inv.invoice_type, "value") else str(inv.invoice_type)

        if inv.invoice_type == InvoiceType.SALES:
            cash_part = inv.cash_amount or Decimal("0.00")
            bank_part = (inv.card_amount or Decimal("0.00")) + (inv.advance_amount or Decimal("0.00"))
            credit_part = inv.balance_amount or Decimal("0.00")

            cash_inflows += cash_part
            bank_inflows += bank_part
            credit_sales += credit_part

            entries.append({
                "id": f"inv_{inv.id}",
                "time": inv.created_at.strftime("%H:%M") if inv.created_at else "-",
                "voucher_type": "Sales Bill (GST)",
                "voucher_no": inv.invoice_number,
                "party_name": cust_name,
                "particulars": f"Sale Total: ₹{inv.grand_total:.2f} (Cash: ₹{cash_part:.2f}, Bank: ₹{bank_part:.2f}, Udhaari: ₹{credit_part:.2f})",
                "cash_in": float(cash_part),
                "cash_out": 0.0,
                "bank_in": float(bank_part),
                "bank_out": 0.0,
                "credit_amount": float(credit_part),
                "firm_name": f_name,
            })
        elif inv.invoice_type == InvoiceType.PURCHASE:
            paid_part = inv.paid_amount or Decimal("0.00")
            cash_outflows += paid_part
            entries.append({
                "id": f"pur_{inv.id}",
                "time": inv.created_at.strftime("%H:%M") if inv.created_at else "-",
                "voucher_type": "Purchase Bill",
                "voucher_no": inv.invoice_number,
                "party_name": cust_name,
                "particulars": f"Inward Bill: ₹{inv.grand_total:.2f} (Paid: ₹{paid_part:.2f})",
                "cash_in": 0.0,
                "cash_out": float(paid_part),
                "bank_in": 0.0,
                "bank_out": 0.0,
                "credit_amount": float(inv.balance_amount or 0),
                "firm_name": f_name,
            })
        elif inv.invoice_type == InvoiceType.CREDIT_NOTE:
            entries.append({
                "id": f"cn_{inv.id}",
                "time": inv.created_at.strftime("%H:%M") if inv.created_at else "-",
                "voucher_type": "Sales Return (CN)",
                "voucher_no": inv.invoice_number,
                "party_name": cust_name,
                "particulars": f"Goods Returned by Customer (Orig: #{inv.original_invoice_number or '-'})",
                "cash_in": 0.0,
                "cash_out": 0.0,
                "bank_in": 0.0,
                "bank_out": 0.0,
                "credit_amount": -float(inv.grand_total),
                "firm_name": f_name,
            })
        elif inv.invoice_type == InvoiceType.DEBIT_NOTE:
            entries.append({
                "id": f"dn_{inv.id}",
                "time": inv.created_at.strftime("%H:%M") if inv.created_at else "-",
                "voucher_type": "Purchase Return (DN)",
                "voucher_no": inv.invoice_number,
                "party_name": cust_name,
                "particulars": f"Goods Returned to Vendor (Orig: #{inv.original_invoice_number or '-'})",
                "cash_in": 0.0,
                "cash_out": 0.0,
                "bank_in": 0.0,
                "bank_out": 0.0,
                "credit_amount": float(inv.grand_total),
                "firm_name": f_name,
            })

    # Process Payments
    for pmt in day_payments:
        cust_name = pmt.customer.name if pmt.customer else "Counter Party"
        f_name = pmt.firm.name if pmt.firm else ""
        mode = pmt.payment_mode.value if hasattr(pmt.payment_mode, "value") else str(pmt.payment_mode).lower()
        is_cash = mode == "cash"
        amt = pmt.amount or Decimal("0.00")

        if pmt.payment_type == PaymentType.RECEIPT:
            if is_cash:
                cash_inflows += amt
            else:
                bank_inflows += amt

            entries.append({
                "id": f"pmt_{pmt.id}",
                "time": pmt.created_at.strftime("%H:%M") if pmt.created_at else "-",
                "voucher_type": "Customer Receipt (जमा)",
                "voucher_no": pmt.payment_number,
                "party_name": cust_name,
                "particulars": f"Received via {mode.upper()} - {pmt.notes or 'Dues settlement'}",
                "cash_in": float(amt) if is_cash else 0.0,
                "cash_out": 0.0,
                "bank_in": 0.0 if is_cash else float(amt),
                "bank_out": 0.0,
                "credit_amount": 0.0,
                "firm_name": f_name,
            })
        elif pmt.payment_type == PaymentType.PAYMENT:
            if is_cash:
                cash_outflows += amt
            else:
                bank_outflows += amt

            entries.append({
                "id": f"pmt_{pmt.id}",
                "time": pmt.created_at.strftime("%H:%M") if pmt.created_at else "-",
                "voucher_type": "Supplier Payment (भुगतान)",
                "voucher_no": pmt.payment_number,
                "party_name": cust_name,
                "particulars": f"Disbursed via {mode.upper()} - {pmt.notes or 'Vendor payment'}",
                "cash_in": 0.0,
                "cash_out": float(amt) if is_cash else 0.0,
                "bank_in": 0.0,
                "bank_out": 0.0 if is_cash else float(amt),
                "credit_amount": 0.0,
                "firm_name": f_name,
            })

    net_cash_delta = cash_inflows - cash_outflows

    return {
        "date": target_date.strftime("%d/%m/%Y"),
        "raw_date": target_date.isoformat(),
        "summary": {
            "cash_inflows": float(cash_inflows),
            "bank_inflows": float(bank_inflows),
            "total_collections": float(cash_inflows + bank_inflows),
            "credit_sales": float(credit_sales),
            "cash_outflows": float(cash_outflows),
            "bank_outflows": float(bank_outflows),
            "total_outflows": float(cash_outflows + bank_outflows),
            "net_cash_delta": float(net_cash_delta),
            "vouchers_count": len(entries),
        },
        "entries": entries,
    }


@router.get("/tally-xml")
def export_tally_xml(
    firm_id: Optional[Any] = Query(None, description="Firm ID or 'all'"),
    start_date: Optional[Any] = Query(None),
    end_date: Optional[Any] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Export Sales Invoices & Receipts into Tally ERP 9 / Tally Prime compatible XML.
    Shop accountants can directly click 'Import Data -> Vouchers' in Tally to import.
    """
    if not isinstance(start_date, date):
        if isinstance(start_date, str) and start_date.strip():
            start_date = date.fromisoformat(start_date.strip())
        else:
            start_date = None

    if not isinstance(end_date, date):
        if isinstance(end_date, str) and end_date.strip():
            end_date = date.fromisoformat(end_date.strip())
        else:
            end_date = None

    q = db.query(Invoice).options(
        joinedload(Invoice.firm),
        joinedload(Invoice.customer),
        joinedload(Invoice.items)
    ).filter(
        Invoice.invoice_type == InvoiceType.SALES,
        Invoice.is_cancelled == False
    )

    if firm_id and str(firm_id).lower() != 'all':
        q = q.filter(Invoice.firm_id == int(firm_id))
    if start_date:
        q = q.filter(Invoice.invoice_date >= start_date)
    if end_date:
        q = q.filter(Invoice.invoice_date <= end_date)

    invoices = q.order_by(Invoice.invoice_date.asc()).all()

    # Build Tally XML
    xml_parts = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<ENVELOPE>',
        '  <HEADER>',
        '    <TALLYREQUEST>Import Data</TALLYREQUEST>',
        '  </HEADER>',
        '  <BODY>',
        '    <IMPORTDATA>',
        '      <REQUESTDESC>',
        '        <REPORTNAME>Vouchers</REPORTNAME>',
        '      </REQUESTDESC>',
        '      <REQUESTDATA>',
    ]

    for inv in invoices:
        party_name = (inv.customer.name if inv.customer else "Cash Customer").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        v_date = inv.invoice_date.strftime("%Y%m%d") if inv.invoice_date else "20260401"
        v_no = inv.invoice_number
        taxable = inv.subtotal or Decimal("0.00")
        cgst = inv.total_cgst or Decimal("0.00")
        sgst = inv.total_sgst or Decimal("0.00")
        igst = inv.total_igst or Decimal("0.00")
        total = inv.grand_total or Decimal("0.00")

        xml_parts.append('        <TALLYMESSAGE xmlns:UDF="TallyUDF">')
        xml_parts.append(f'          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">')
        xml_parts.append(f'            <DATE>{v_date}</DATE>')
        xml_parts.append(f'            <VOUCHERNUMBER>{v_no}</VOUCHERNUMBER>')
        xml_parts.append(f'            <PARTYLEDGERNAME>{party_name}</PARTYLEDGERNAME>')
        xml_parts.append(f'            <BASICBUYERNAME>{party_name}</BASICBUYERNAME>')
        xml_parts.append(f'            <ISINVOICE>Yes</ISINVOICE>')

        # Party Ledger (Debit)
        xml_parts.append('            <ALLLEDGERENTRIES.LIST>')
        xml_parts.append(f'              <LEDGERNAME>{party_name}</LEDGERNAME>')
        xml_parts.append('              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>')
        xml_parts.append(f'              <AMOUNT>-{total:.2f}</AMOUNT>')
        xml_parts.append('            </ALLLEDGERENTRIES.LIST>')

        # Sales Account (Credit)
        xml_parts.append('            <ALLLEDGERENTRIES.LIST>')
        xml_parts.append('              <LEDGERNAME>Sales Account (5% GST)</LEDGERNAME>')
        xml_parts.append('              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>')
        xml_parts.append(f'              <AMOUNT>{taxable:.2f}</AMOUNT>')
        xml_parts.append('            </ALLLEDGERENTRIES.LIST>')

        # Tax Ledgers
        if cgst > 0:
            xml_parts.append('            <ALLLEDGERENTRIES.LIST>')
            xml_parts.append('              <LEDGERNAME>Output CGST 2.5%</LEDGERNAME>')
            xml_parts.append('              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>')
            xml_parts.append(f'              <AMOUNT>{cgst:.2f}</AMOUNT>')
            xml_parts.append('            </ALLLEDGERENTRIES.LIST>')
        if sgst > 0:
            xml_parts.append('            <ALLLEDGERENTRIES.LIST>')
            xml_parts.append('              <LEDGERNAME>Output SGST 2.5%</LEDGERNAME>')
            xml_parts.append('              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>')
            xml_parts.append(f'              <AMOUNT>{sgst:.2f}</AMOUNT>')
            xml_parts.append('            </ALLLEDGERENTRIES.LIST>')
        if igst > 0:
            xml_parts.append('            <ALLLEDGERENTRIES.LIST>')
            xml_parts.append('              <LEDGERNAME>Output IGST 5%</LEDGERNAME>')
            xml_parts.append('              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>')
            xml_parts.append(f'              <AMOUNT>{igst:.2f}</AMOUNT>')
            xml_parts.append('            </ALLLEDGERENTRIES.LIST>')

        xml_parts.append('          </VOUCHER>')
        xml_parts.append('        </TALLYMESSAGE>')

    xml_parts.extend([
        '      </REQUESTDATA>',
        '    </IMPORTDATA>',
        '  </BODY>',
        '</ENVELOPE>'
    ])

    xml_content = "\n".join(xml_parts)
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=SyncBill_Tally_{start_date or 'ALL'}_to_{end_date or 'TODAY'}.xml"}
    )



