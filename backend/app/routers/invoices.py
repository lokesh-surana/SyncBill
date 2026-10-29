from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal, ROUND_HALF_UP
from datetime import date

from app.database import get_db
from app.models.firm import Firm
from app.models.customer import Customer
from app.models.item import Item
from app.models.invoice import Invoice, InvoiceItem, InvoiceType, PaymentStatus
from app.schemas.invoice import InvoiceCreate, InvoiceResponse

router = APIRouter(prefix="/invoices", tags=["Invoices & GST Billing"])


def round2(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@router.get("/", response_model=List[InvoiceResponse])
def get_invoices(
    firm_id: Optional[int] = Query(None, description="Filter by firm"),
    customer_id: Optional[int] = Query(None, description="Filter by customer"),
    invoice_type: Optional[InvoiceType] = Query(None, description="Filter by type (sales/purchase/quotation)"),
    payment_status: Optional[PaymentStatus] = Query(None, description="Filter by payment status"),
    start_date: Optional[date] = Query(None, description="Filter from start date"),
    end_date: Optional[date] = Query(None, description="Filter to end date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    """Retrieve invoices with multi-firm, date range, and status filtering."""
    query = db.query(Invoice).options(joinedload(Invoice.customer))
    if firm_id:
        query = query.filter(Invoice.firm_id == firm_id)
    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)
    if invoice_type:
        query = query.filter(Invoice.invoice_type == invoice_type)
    if payment_status:
        query = query.filter(Invoice.payment_status == payment_status)
    if start_date:
        query = query.filter(Invoice.invoice_date >= start_date)
    if end_date:
        query = query.filter(Invoice.invoice_date <= end_date)

    return query.order_by(Invoice.invoice_date.desc(), Invoice.id.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(invoice_in: InvoiceCreate, db: Session = Depends(get_db)):
    """
    Create a new Tax Invoice / Purchase Bill with:
    - Auto-detection of Intra-state (CGST+SGST) vs Inter-state (IGST) using GSTIN state codes.
    - Automatic calculation of taxable values, taxes, and round-offs.
    - Automatic inventory stock increment/decrement based on invoice type.
    """
    firm = db.query(Firm).filter(Firm.id == invoice_in.firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail=f"Firm {invoice_in.firm_id} not found.")

    customer = db.query(Customer).filter(Customer.id == invoice_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {invoice_in.customer_id} not found.")

    # 1. Determine Firm state code (from first 2 chars of GSTIN or customer)
    firm_state = firm.gstin[:2] if (firm.gstin and len(firm.gstin) >= 2) else "27"
    place_of_supply = invoice_in.place_of_supply or customer.state_code or firm_state
    is_intra_state = (firm_state == place_of_supply)

    # 2. Generate invoice number if not passed
    invoice_number = invoice_in.invoice_number
    if not invoice_number:
        count = db.query(Invoice).filter(Invoice.firm_id == firm.id).count() + 1
        if invoice_in.invoice_type == InvoiceType.CREDIT_NOTE:
            prefix = "CN"
        elif invoice_in.invoice_type == InvoiceType.DEBIT_NOTE:
            prefix = "DN"
        elif invoice_in.invoice_type == InvoiceType.SALES:
            prefix = "INV"
        elif invoice_in.invoice_type == InvoiceType.PURCHASE:
            prefix = "BILL"
        elif invoice_in.invoice_type == InvoiceType.QUOTATION:
            prefix = "EST"
        else:
            prefix = "DOC"
        invoice_number = f"{prefix}-{date.today().year}-{count:04d}"

    # 3. Process line items and compute taxes
    subtotal = Decimal("0.00")
    total_cgst = Decimal("0.00")
    total_sgst = Decimal("0.00")
    total_igst = Decimal("0.00")
    total_discount = Decimal("0.00")

    db_items = []
    for line in invoice_in.items:
        qty = Decimal(str(line.quantity))
        rate = Decimal(str(line.rate))
        gross = qty * rate

        # Successive cash discounts (CD1, CD2, CD3) as in Accurate ERP
        cd1 = Decimal(str(line.cd1_percent or 0))
        cd2 = Decimal(str(line.cd2_percent or 0))
        cd3 = Decimal(str(line.cd3_percent or 0))
        disc_percent = Decimal(str(line.discount_percent or 0))

        after_disc = gross
        if cd1 > 0:
            after_disc = after_disc * (Decimal("1.00") - (cd1 / Decimal("100.00")))
        if cd2 > 0:
            after_disc = after_disc * (Decimal("1.00") - (cd2 / Decimal("100.00")))
        if cd3 > 0:
            after_disc = after_disc * (Decimal("1.00") - (cd3 / Decimal("100.00")))
        if disc_percent > 0 and cd1 == 0 and cd2 == 0 and cd3 == 0:
            after_disc = after_disc * (Decimal("1.00") - (disc_percent / Decimal("100.00")))

        disc_amount = round2(gross - after_disc)
        taxable = gross - disc_amount

        # Default GST rate is 5% unless specified
        gst_rate = Decimal(str(line.gst_rate))

        if is_intra_state:
            cgst_rate = round2(gst_rate / Decimal("2.00"))
            sgst_rate = round2(gst_rate / Decimal("2.00"))
            igst_rate = Decimal("0.00")

            cgst_amt = round2(taxable * (cgst_rate / Decimal("100.00")))
            sgst_amt = round2(taxable * (sgst_rate / Decimal("100.00")))
            igst_amt = Decimal("0.00")
        else:
            cgst_rate = Decimal("0.00")
            sgst_rate = Decimal("0.00")
            igst_rate = gst_rate

            cgst_amt = Decimal("0.00")
            sgst_amt = Decimal("0.00")
            igst_amt = round2(taxable * (igst_rate / Decimal("100.00")))

        line_total = taxable + cgst_amt + sgst_amt + igst_amt

        subtotal += taxable
        total_cgst += cgst_amt
        total_sgst += sgst_amt
        total_igst += igst_amt
        total_discount += disc_amount

        # Adjust item inventory stock if linked to Item
        if line.item_id:
            inv_item = db.query(Item).filter(Item.id == line.item_id).first()
            if inv_item:
                if invoice_in.invoice_type == InvoiceType.SALES:
                    inv_item.current_stock -= qty
                elif invoice_in.invoice_type == InvoiceType.PURCHASE:
                    inv_item.current_stock += qty
                elif invoice_in.invoice_type == InvoiceType.CREDIT_NOTE:
                    inv_item.current_stock += qty  # Sales return restores inventory stock
                elif invoice_in.invoice_type == InvoiceType.DEBIT_NOTE:
                    inv_item.current_stock -= qty  # Purchase return decrements inventory stock

        db_items.append(
            InvoiceItem(
                item_id=line.item_id,
                item_name=line.item_name,
                hsn_code=line.hsn_code,
                size=line.size,
                color=line.color,
                mrp=line.mrp,
                cd1_percent=line.cd1_percent,
                cd2_percent=line.cd2_percent,
                cd3_percent=line.cd3_percent,
                remarks=line.remarks,
                quantity=qty,
                uom=line.uom,
                rate=rate,
                discount_percent=disc_percent,
                discount_amount=disc_amount,
                taxable_amount=taxable,
                gst_rate=gst_rate,
                cgst_rate=cgst_rate,
                cgst_amount=cgst_amt,
                sgst_rate=sgst_rate,
                sgst_amount=sgst_amt,
                igst_rate=igst_rate,
                igst_amount=igst_amt,
                total_amount=line_total,
            )
        )

    total_tax = total_cgst + total_sgst + total_igst
    transport_charges = Decimal(str(invoice_in.transport_charges or 0.00))
    raw_grand_total = subtotal + total_tax + transport_charges
    rounded_grand_total = raw_grand_total.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    round_off = rounded_grand_total - raw_grand_total

    paid_amt = Decimal(str(invoice_in.paid_amount))
    balance_amt = rounded_grand_total - paid_amt

    if paid_amt >= rounded_grand_total:
        pay_status = PaymentStatus.PAID
    elif paid_amt > 0:
        pay_status = PaymentStatus.PARTIAL
    else:
        pay_status = PaymentStatus.UNPAID

    new_invoice = Invoice(
        firm_id=invoice_in.firm_id,
        customer_id=invoice_in.customer_id,
        invoice_number=invoice_number,
        invoice_type=invoice_in.invoice_type,
        invoice_date=invoice_in.invoice_date or date.today(),
        due_date=invoice_in.due_date,
        place_of_supply=place_of_supply,
        is_reverse_charge=invoice_in.is_reverse_charge,
        subtotal=subtotal,
        total_cgst=total_cgst,
        total_sgst=total_sgst,
        total_igst=total_igst,
        total_tax=total_tax,
        total_discount=total_discount,
        round_off=round_off,
        grand_total=rounded_grand_total,
        paid_amount=paid_amt,
        balance_amount=balance_amt,
        payment_status=pay_status,
        notes=invoice_in.notes,
        terms_conditions=invoice_in.terms_conditions,
        transport_name=invoice_in.transport_name,
        vehicle_number=invoice_in.vehicle_number,
        lr_number=invoice_in.lr_number,
        lr_date=invoice_in.lr_date,
        destination=invoice_in.destination,
        number_of_parcels=invoice_in.number_of_parcels,
        rate_type=invoice_in.rate_type or "retail",
        vendor_bill_number=invoice_in.vendor_bill_number,
        vendor_bill_date=invoice_in.vendor_bill_date,
        recd_date=invoice_in.recd_date,
        transport_charges=transport_charges,
        advance_amount=Decimal(str(invoice_in.advance_amount or 0.00)),
        card_amount=Decimal(str(invoice_in.card_amount or 0.00)),
        cash_amount=Decimal(str(invoice_in.cash_amount or 0.00)),
        credit_amount=Decimal(str(invoice_in.credit_amount or 0.00)),
        original_invoice_id=invoice_in.original_invoice_id,
        original_invoice_number=invoice_in.original_invoice_number,
        return_reason=invoice_in.return_reason,
        items=db_items,
    )

    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    return new_invoice


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Fetch complete details of an invoice including line items."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found.")
    return invoice


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
def cancel_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Cancel an invoice and revert inventory adjustments."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found.")
    if invoice.is_cancelled:
        raise HTTPException(status_code=400, detail="Invoice is already cancelled.")

    # Revert stock adjustments
    for line in invoice.items:
        if line.item_id:
            inv_item = db.query(Item).filter(Item.id == line.item_id).first()
            if inv_item:
                if invoice.invoice_type == InvoiceType.SALES:
                    inv_item.current_stock += line.quantity
                elif invoice.invoice_type == InvoiceType.PURCHASE:
                    inv_item.current_stock -= line.quantity
                elif invoice.invoice_type == InvoiceType.CREDIT_NOTE:
                    inv_item.current_stock -= line.quantity
                elif invoice.invoice_type == InvoiceType.DEBIT_NOTE:
                    inv_item.current_stock += line.quantity

    invoice.is_cancelled = True
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{invoice_id}/returnable-items")
def get_returnable_items(invoice_id: int, db: Session = Depends(get_db)):
    """
    Fetch an invoice and calculate remaining returnable items and quantities,
    subtracting any already created Credit Notes or Debit Notes.
    """
    invoice = db.query(Invoice).options(
        joinedload(Invoice.customer),
        joinedload(Invoice.items)
    ).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found.")

    # Find any existing active return vouchers linked to this invoice
    return_type = InvoiceType.CREDIT_NOTE if invoice.invoice_type == InvoiceType.SALES else InvoiceType.DEBIT_NOTE
    past_returns = db.query(Invoice).filter(
        Invoice.original_invoice_id == invoice.id,
        Invoice.invoice_type == return_type,
        Invoice.is_cancelled == False
    ).all()

    # Sum already returned quantities by item_id (or item_name)
    already_returned = {}
    for ret_inv in past_returns:
        for item in ret_inv.items:
            key = item.item_id if item.item_id else item.item_name
            already_returned[key] = already_returned.get(key, Decimal("0.000")) + item.quantity

    items_data = []
    for line in invoice.items:
        key = line.item_id if line.item_id else line.item_name
        prev_ret_qty = already_returned.get(key, Decimal("0.000"))
        remaining_qty = max(Decimal("0.000"), line.quantity - prev_ret_qty)

        items_data.append({
            "item_id": line.item_id,
            "item_name": line.item_name,
            "hsn_code": line.hsn_code,
            "size": line.size,
            "color": line.color,
            "mrp": float(line.mrp) if line.mrp else None,
            "original_quantity": float(line.quantity),
            "already_returned_quantity": float(prev_ret_qty),
            "returnable_quantity": float(remaining_qty),
            "uom": line.uom,
            "rate": float(line.rate),
            "cd1_percent": float(line.cd1_percent or 0),
            "cd2_percent": float(line.cd2_percent or 0),
            "cd3_percent": float(line.cd3_percent or 0),
            "discount_percent": float(line.discount_percent or 0),
            "gst_rate": float(line.gst_rate or 5.0),
        })

    return {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "invoice_type": invoice.invoice_type.value,
        "invoice_date": invoice.invoice_date.strftime("%Y-%m-%d") if invoice.invoice_date else None,
        "firm_id": invoice.firm_id,
        "customer_id": invoice.customer_id,
        "customer_name": invoice.customer.name if invoice.customer else "",
        "customer_phone": invoice.customer.phone if invoice.customer else "",
        "customer_gstin": invoice.customer.gstin if invoice.customer else "",
        "place_of_supply": invoice.place_of_supply,
        "rate_type": invoice.rate_type,
        "grand_total": float(invoice.grand_total),
        "items": items_data,
        "has_returnable_items": any(it["returnable_quantity"] > 0 for it in items_data),
    }


@router.get("/{invoice_id}/print", response_class=HTMLResponse)
def print_invoice_html(invoice_id: int, db: Session = Depends(get_db)):
    """Render a clean, professional, print-ready Indian GST Tax Invoice (A4)."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found.")

    firm = invoice.firm
    customer = invoice.customer

    # Build line items table HTML
    rows_html = ""
    for idx, item in enumerate(invoice.items, start=1):
        rows_html += f"""
        <tr>
            <td style="text-align: center;">{idx}</td>
            <td><strong>{item.item_name}</strong></td>
            <td style="text-align: center;">{item.hsn_code or '-'}</td>
            <td style="text-align: right;">{item.quantity:.3f} {item.uom}</td>
            <td style="text-align: right;">Rs. {item.rate:.2f}</td>
            <td style="text-align: right;">{item.discount_percent:.2f}%</td>
            <td style="text-align: right;">Rs. {item.taxable_amount:.2f}</td>
            <td style="text-align: right;">{item.gst_rate:.1f}%</td>
            <td style="text-align: right;">Rs. {item.total_amount:.2f}</td>
        </tr>
        """

    is_purchase = (invoice.invoice_type == InvoiceType.PURCHASE)
    is_credit_note = (invoice.invoice_type == InvoiceType.CREDIT_NOTE)
    is_debit_note = (invoice.invoice_type == InvoiceType.DEBIT_NOTE)

    if is_credit_note:
        badge_title = "CREDIT NOTE (SALES RETURN / GR VOUCHER)"
        theme_color = "#e11d48"
        party_title = "Credit To Party (Customer)"
    elif is_debit_note:
        badge_title = "DEBIT NOTE (PURCHASE RETURN VOUCHER)"
        theme_color = "#ea580c"
        party_title = "Debit To Supplier / Vendor"
    elif is_purchase:
        badge_title = "PURCHASE BILL / INWARD VOUCHER"
        theme_color = "#0f766e"
        party_title = "Supplier / Vendor Details"
    elif invoice.invoice_type == InvoiceType.QUOTATION:
        badge_title = "QUOTATION / ESTIMATE"
        theme_color = "#6366f1"
        party_title = "Quotation For"
    else:
        badge_title = "TAX INVOICE"
        theme_color = "#2b6cb0"
        party_title = "Billed To (Customer)"

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{badge_title} #{invoice.invoice_number}</title>
    <style>
        @page {{ size: A4; margin: 15mm; }}
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a202c; margin: 0; padding: 20px; font-size: 13px; }}
        .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid {theme_color}; padding-bottom: 15px; margin-bottom: 15px; }}
        .title-badge {{ background: {theme_color}; color: white; padding: 6px 14px; border-radius: 4px; font-size: 14px; font-weight: bold; text-transform: uppercase; }}
        .parties {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
        .party-box {{ width: 48%; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; background: #f8fafc; }}
        .party-box h4 {{ margin: 0 0 6px 0; color: #2d3748; font-size: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }}
        th {{ background: #edf2f7; color: #2d3748; padding: 8px; border: 1px solid #cbd5e1; font-weight: 600; }}
        td {{ padding: 8px; border: 1px solid #cbd5e1; }}
        .totals-box {{ width: 350px; margin-left: auto; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }}
        .totals-row {{ display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; }}
        .grand-total {{ background: {'#0f766e' if is_purchase else '#2b6cb0'}; color: white; font-size: 15px; font-weight: bold; }}
        .footer {{ margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }}
        .signatory {{ text-align: center; border-top: 1px dashed #718096; width: 200px; padding-top: 6px; }}
        @media print {{
            .no-print {{ display: none; }}
            body {{ padding: 0; }}
        }}
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 15px; text-align: right;">
        <button onclick="window.print()" style="background: {'#0f766e' if is_purchase else '#2b6cb0'}; color: white; border: none; padding: 8px 16px; font-weight: bold; border-radius: 4px; cursor: pointer;">Print / Save as PDF</button>
    </div>

    <div class="header">
        <div>
            <h2 style="margin: 0; color: {'#0f766e' if is_purchase else '#2b6cb0'};">{firm.name}</h2>
            <div style="color: #4a5568; margin-top: 4px;">{firm.address or 'Registered Office'}</div>
            <div style="font-weight: 600; margin-top: 4px;">GSTIN: <span style="font-family: monospace;">{firm.gstin or 'URP'}</span></div>
        </div>
        <div style="text-align: right;">
            <div class="title-badge">{badge_title}</div>
            <div style="margin-top: 8px;"><strong>{'Voucher' if (is_credit_note or is_debit_note) else ('Bill' if is_purchase else 'Invoice')} No:</strong> {invoice.invoice_number}</div>
            <div><strong>Date:</strong> {invoice.invoice_date}</div>
            {f'<div><strong style="color: {theme_color};">Original Bill Ref:</strong> #{invoice.original_invoice_number}</div>' if invoice.original_invoice_number else ''}
            {f'<div><strong>Return Reason:</strong> {invoice.return_reason}</div>' if invoice.return_reason else ''}
            <div><strong>Place of Supply:</strong> State Code {invoice.place_of_supply or '-'}</div>
        </div>
    </div>

    <div class="parties">
        <div class="party-box">
            <h4>{party_title}</h4>
            <div><strong>{customer.name}</strong></div>
            <div>{customer.billing_address or 'Counter Walk-in / Standard Address'}</div>
            <div><strong>GSTIN:</strong> {customer.gstin or 'URP (Unregistered)'}</div>
            <div><strong>Phone:</strong> {customer.phone or '-'}</div>
        </div>
        <div class="party-box">
            <h4>Payment & Terms</h4>
            <div><strong>Payment Status:</strong> <span style="text-transform: uppercase;">{invoice.payment_status.value}</span></div>
            <div><strong>Amount Paid:</strong> Rs. {invoice.paid_amount:.2f}</div>
            <div><strong>Balance Due:</strong> Rs. {invoice.balance_amount:.2f}</div>
            <div><strong>Reverse Charge:</strong> {'Yes' if invoice.is_reverse_charge else 'No'}</div>
        </div>
    </div>

    {f'''
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; margin-bottom: 16px; font-size: 11.5px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
        <div><span style="color: #64748b;">Transport:</span> <strong>{invoice.transport_name or '-'}</strong></div>
        <div><span style="color: #64748b;">Vehicle No:</span> <strong>{invoice.vehicle_number or '-'}</strong></div>
        <div><span style="color: #64748b;">L.R. / Bilty:</span> <strong>{invoice.lr_number or '-'}</strong></div>
        <div><span style="color: #64748b;">L.R. Date:</span> <strong>{invoice.lr_date or '-'}</strong></div>
        <div><span style="color: #64748b;">Destination:</span> <strong>{invoice.destination or '-'}</strong></div>
        <div><span style="color: #64748b;">Parcels/Bales:</span> <strong>{invoice.number_of_parcels or '-'}</strong></div>
    </div>
    ''' if (invoice.transport_name or invoice.vehicle_number or invoice.lr_number or invoice.destination or invoice.number_of_parcels) else ''}

    <table>
        <thead>
            <tr>
                <th style="width: 30px;">#</th>
                <th>Item Description</th>
                <th style="width: 70px;">HSN</th>
                <th style="width: 75px;">Qty</th>
                <th style="width: 80px;">Rate</th>
                <th style="width: 55px;">Disc %</th>
                <th style="width: 85px;">Taxable</th>
                <th style="width: 60px;">GST %</th>
                <th style="width: 95px;">Total</th>
            </tr>
        </thead>
        <tbody>
            {rows_html}
        </tbody>
    </table>

    <div class="totals-box">
        <div class="totals-row"><span>Taxable Subtotal:</span><strong>Rs. {invoice.subtotal:.2f}</strong></div>
        <div class="totals-row"><span>CGST:</span><span>Rs. {invoice.total_cgst:.2f}</span></div>
        <div class="totals-row"><span>SGST:</span><span>Rs. {invoice.total_sgst:.2f}</span></div>
        <div class="totals-row"><span>IGST:</span><span>Rs. {invoice.total_igst:.2f}</span></div>
        <div class="totals-row"><span>Round Off:</span><span>Rs. {invoice.round_off:.2f}</span></div>
        <div class="totals-row grand-total"><span>Grand Total:</span><span>Rs. {invoice.grand_total:.2f}</span></div>
    </div>

    <div class="footer">
        <div>
            <div style="font-weight: 600; margin-bottom: 4px;">Terms & Conditions:</div>
            <div style="color: #718096; font-size: 11px;">1. Goods once sold will not be taken back without original bill.<br>2. Subject to Pune jurisdiction only.</div>
        </div>
        <div class="signatory">
            For <strong>{firm.name}</strong><br><br><br>
            Authorized Signatory
        </div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.get("/{invoice_id}/delivery-challan", response_class=HTMLResponse)
def print_delivery_challan_html(invoice_id: int, db: Session = Depends(get_db)):
    """Render a clean, professional, print-ready Delivery Challan (Rule 55 - Transportation of Goods)."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found.")

    firm = invoice.firm
    customer = invoice.customer

    rows_html = ""
    total_qty = Decimal("0.000")
    for idx, item in enumerate(invoice.items, start=1):
        total_qty += item.quantity
        size_str = f" [Size: {item.size}]" if item.size else ""
        color_str = f" [Color: {item.color}]" if getattr(item, 'color', None) else ""
        rows_html += f"""
        <tr>
            <td style="text-align: center;">{idx}</td>
            <td><strong>{item.item_name}</strong>{size_str}{color_str}</td>
            <td style="text-align: center;">{item.hsn_code or '-'}</td>
            <td style="text-align: right; font-weight: bold;">{item.quantity:.3f} {item.uom}</td>
            <td style="text-align: center;">{item.size or '-'}</td>
            <td>{item.remarks or '-'}</td>
        </tr>
        """

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Delivery Challan #{invoice.invoice_number}</title>
    <style>
        @page {{ size: A4; margin: 15mm; }}
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a202c; margin: 0; padding: 20px; font-size: 13px; }}
        .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 12px; }}
        .title-badge {{ background: #0f766e; color: white; padding: 6px 14px; border-radius: 4px; font-size: 14px; font-weight: bold; text-transform: uppercase; }}
        .parties {{ display: flex; justify-content: space-between; margin-bottom: 14px; }}
        .party-box {{ width: 48%; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; background: #f8fafc; }}
        .party-box h4 {{ margin: 0 0 6px 0; color: #2d3748; font-size: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }}
        th {{ background: #f0fdfa; color: #134e4a; padding: 8px; border: 1px solid #cbd5e1; font-weight: 600; }}
        td {{ padding: 8px; border: 1px solid #cbd5e1; }}
        .footer {{ margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }}
        .signatory {{ text-align: center; border-top: 1px dashed #718096; width: 220px; padding-top: 6px; }}
        .rule-tag {{ font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }}
        @media print {{
            .no-print {{ display: none; }}
            body {{ padding: 0; }}
        }}
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 15px; display: flex; gap: 10px;">
        <button onclick="window.print()" style="padding: 8px 16px; background: #0f766e; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Print Delivery Challan</button>
        <button onclick="window.close()" style="padding: 8px 16px; background: #cbd5e1; color: #334155; border: none; border-radius: 4px; cursor: pointer;">Close</button>
    </div>

    <div class="header">
        <div>
            <h2 style="margin: 0; color: #0f766e; font-size: 22px;">{firm.name}</h2>
            <div style="color: #4a5568; margin-top: 4px;">{firm.address or ''}</div>
            <div style="font-weight: 600; margin-top: 2px;">GSTIN: {firm.gstin or 'Unregistered'} | State: Maharashtra (27)</div>
        </div>
        <div style="text-align: right;">
            <div class="title-badge">DELIVERY CHALLAN</div>
            <div class="rule-tag">(RULE 55 - TRANSPORTATION OF GOODS)</div>
            <div style="margin-top: 6px; font-size: 13px;"><strong>Challan No:</strong> DC-{invoice.invoice_number}</div>
            <div style="font-size: 13px;"><strong>Date:</strong> {invoice.invoice_date.strftime('%d/%m/%Y')}</div>
        </div>
    </div>

    <div class="parties">
        <div class="party-box">
            <h4>CONSIGNOR (DISPATCH FROM)</h4>
            <div><strong>{firm.name}</strong></div>
            <div>{firm.address or ''}</div>
            <div>GSTIN: {firm.gstin or '-'}</div>
        </div>
        <div class="party-box">
            <h4>CONSIGNEE (DELIVER TO)</h4>
            <div><strong>{customer.name}</strong></div>
            <div>{customer.billing_address or 'Local Delivery'}</div>
            <div>GSTIN: {customer.gstin or 'Unregistered / B2C'}</div>
            <div>Phone: {customer.phone or '-'}</div>
        </div>
    </div>

    <div style="margin-bottom: 14px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; padding: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px;">
        <div><span style="color: #64748b;">Transporter:</span> <strong>{invoice.transport_name or '-'}</strong></div>
        <div><span style="color: #64748b;">Vehicle No:</span> <strong>{invoice.vehicle_number or '-'}</strong></div>
        <div><span style="color: #64748b;">L.R. / Bilty:</span> <strong>{invoice.lr_number or '-'}</strong></div>
        <div><span style="color: #64748b;">L.R. Date:</span> <strong>{invoice.lr_date.strftime('%d/%m/%Y') if invoice.lr_date else '-'}</strong></div>
        <div><span style="color: #64748b;">Destination:</span> <strong>{invoice.destination or '-'}</strong></div>
        <div><span style="color: #64748b;">No. of Parcels / Bales:</span> <strong>{invoice.number_of_parcels or '-'}</strong></div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 30px;">#</th>
                <th>Item Description / Particulars</th>
                <th style="width: 80px;">HSN Code</th>
                <th style="width: 100px;">Quantity</th>
                <th style="width: 80px;">Size</th>
                <th>Remarks / Bundle No</th>
            </tr>
        </thead>
        <tbody>
            {rows_html}
            <tr style="background: #f8fafc; font-weight: bold;">
                <td colspan="3" style="text-align: right;">Total Quantity Dispatched:</td>
                <td style="text-align: right; color: #0f766e; font-size: 13px;">{total_qty:.3f} Pcs</td>
                <td colspan="2"></td>
            </tr>
        </tbody>
    </table>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 11.5px; color: #475569; margin-bottom: 20px;">
        <strong>Declaration:</strong> This delivery challan is issued under Rule 55 of CGST Rules for the transportation of goods without invoice (goods sent for approval / job-work / delivery). Not a Tax Invoice.
    </div>

    <div class="footer">
        <div class="signatory">
            Receiver's Signature & Stamp<br><br><br>
            (Date & Time Received)
        </div>
        <div class="signatory">
            For <strong>{firm.name}</strong><br><br><br>
            Authorized Dispatcher
        </div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.get("/{invoice_id}/official-pdf")
def get_invoice_official_pdf(invoice_id: int, db: Session = Depends(get_db)):
    """Retrieve the authentic Accurate .rpt PDF link from Google Drive for this invoice."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with id {invoice_id} not found."
        )
    return {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "vendor_bill_number": invoice.vendor_bill_number,
        "official_pdf_url": invoice.official_pdf_url,
        "official_pdf_drive_id": invoice.official_pdf_drive_id,
        "pdf_updated_at": invoice.pdf_updated_at.isoformat() if invoice.pdf_updated_at else None,
        "is_available": bool(invoice.official_pdf_url)
    }


