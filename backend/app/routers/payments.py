from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal
from datetime import date

from app.database import get_db
from app.models.firm import Firm
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceType, PaymentStatus
from app.models.payment import Payment, PaymentType, PaymentMode
from app.schemas.payment import PaymentCreate, PaymentResponse

router = APIRouter(prefix="/payments", tags=["Payments & Receipts"])


@router.get("/", response_model=List[PaymentResponse])
def get_payments(
    firm_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    invoice_id: Optional[int] = Query(None),
    payment_type: Optional[PaymentType] = Query(None),
    payment_mode: Optional[PaymentMode] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List payment and receipt transactions with filtering."""
    query = db.query(Payment)
    if firm_id:
        query = query.filter(Payment.firm_id == firm_id)
    if customer_id:
        query = query.filter(Payment.customer_id == customer_id)
    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)
    if payment_type:
        query = query.filter(Payment.payment_type == payment_type)
    if payment_mode:
        query = query.filter(Payment.payment_mode == payment_mode)

    return query.order_by(Payment.id.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def record_payment(payment_in: PaymentCreate, db: Session = Depends(get_db)):
    """
    Record a new payment or receipt.
    If linked to an invoice, automatically updates invoice paid_amount, balance_amount, and payment_status.
    """
    firm = db.query(Firm).filter(Firm.id == payment_in.firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail=f"Firm {payment_in.firm_id} not found.")

    customer = db.query(Customer).filter(Customer.id == payment_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer/Vendor {payment_in.customer_id} not found.")

    invoice = None
    if payment_in.invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == payment_in.invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=404, detail=f"Invoice {payment_in.invoice_id} not found.")
        if invoice.is_cancelled:
            raise HTTPException(status_code=400, detail="Cannot record payment against a cancelled invoice.")

    # Generate payment receipt number if missing
    payment_number = payment_in.payment_number
    if not payment_number:
        count = db.query(Payment).filter(Payment.firm_id == firm.id).count() + 1
        prefix = "RCP" if payment_in.payment_type == PaymentType.RECEIPT else "PAY"
        payment_number = f"{prefix}-{date.today().year}-{count:04d}"

    pay_amount = Decimal(str(payment_in.amount))

    # Settle against specific bill allocations if provided
    if payment_in.allocations:
        for alloc in payment_in.allocations:
            alloc_inv = db.query(Invoice).filter(Invoice.id == alloc.invoice_id).first()
            if alloc_inv and not alloc_inv.is_cancelled:
                alloc_amt = Decimal(str(alloc.amount))
                alloc_inv.paid_amount += alloc_amt
                alloc_inv.balance_amount = max(Decimal("0.00"), alloc_inv.grand_total - alloc_inv.paid_amount)
                if alloc_inv.balance_amount <= Decimal("0.00"):
                    alloc_inv.payment_status = PaymentStatus.PAID
                elif alloc_inv.paid_amount > Decimal("0.00"):
                    alloc_inv.payment_status = PaymentStatus.PARTIAL
                else:
                    alloc_inv.payment_status = PaymentStatus.UNPAID
    elif invoice:
        # If single invoice linked
        invoice.paid_amount += pay_amount
        invoice.balance_amount = max(Decimal("0.00"), invoice.grand_total - invoice.paid_amount)
        if invoice.balance_amount <= Decimal("0.00"):
            invoice.payment_status = PaymentStatus.PAID
        elif invoice.paid_amount > Decimal("0.00"):
            invoice.payment_status = PaymentStatus.PARTIAL
        else:
            invoice.payment_status = PaymentStatus.UNPAID
    elif payment_in.payment_type == PaymentType.RECEIPT:
        # Auto-settle oldest unpaid sales invoices FIFO for on-account customer receipt
        unpaid_invoices = (
            db.query(Invoice)
            .filter(
                Invoice.customer_id == payment_in.customer_id,
                Invoice.firm_id == payment_in.firm_id,
                Invoice.invoice_type == InvoiceType.SALES,
                Invoice.is_cancelled == False,
                Invoice.balance_amount > Decimal("0.00"),
            )
            .order_by(Invoice.invoice_date.asc(), Invoice.id.asc())
            .all()
        )
        rem = pay_amount
        for inv in unpaid_invoices:
            if rem <= Decimal("0.00"):
                break
            due = inv.balance_amount
            settle = min(rem, due)
            inv.paid_amount += settle
            inv.balance_amount = max(Decimal("0.00"), inv.grand_total - inv.paid_amount)
            rem -= settle
            if inv.balance_amount <= Decimal("0.00"):
                inv.payment_status = PaymentStatus.PAID
            else:
                inv.payment_status = PaymentStatus.PARTIAL
    elif payment_in.payment_type == PaymentType.PAYMENT:
        # Auto-settle oldest unpaid purchase bills FIFO for on-account vendor payment
        unpaid_purchases = (
            db.query(Invoice)
            .filter(
                Invoice.customer_id == payment_in.customer_id,
                Invoice.firm_id == payment_in.firm_id,
                Invoice.invoice_type == InvoiceType.PURCHASE,
                Invoice.is_cancelled == False,
                Invoice.balance_amount > Decimal("0.00"),
            )
            .order_by(Invoice.invoice_date.asc(), Invoice.id.asc())
            .all()
        )
        rem = pay_amount
        for inv in unpaid_purchases:
            if rem <= Decimal("0.00"):
                break
            due = inv.balance_amount
            settle = min(rem, due)
            inv.paid_amount += settle
            inv.balance_amount = max(Decimal("0.00"), inv.grand_total - inv.paid_amount)
            rem -= settle
            if inv.balance_amount <= Decimal("0.00"):
                inv.payment_status = PaymentStatus.PAID
            else:
                inv.payment_status = PaymentStatus.PARTIAL

    payment = Payment(
        firm_id=payment_in.firm_id,
        customer_id=payment_in.customer_id,
        invoice_id=payment_in.invoice_id,
        payment_number=payment_number,
        payment_type=payment_in.payment_type,
        payment_mode=payment_in.payment_mode,
        amount=pay_amount,
        payment_date=payment_in.payment_date or date.today(),
        reference_number=payment_in.reference_number,
        notes=payment_in.notes,
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    """Fetch details of a single payment."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment {payment_id} not found.")
    return payment


@router.post("/{payment_id}/cancel", response_model=PaymentResponse)
def cancel_payment(payment_id: int, db: Session = Depends(get_db)):
    """Cancel payment and revert invoice balances."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment {payment_id} not found.")
    if payment.is_cancelled:
        raise HTTPException(status_code=400, detail="Payment is already cancelled.")

    if payment.invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
        if invoice and not invoice.is_cancelled:
            invoice.paid_amount -= payment.amount
            invoice.balance_amount = invoice.grand_total - invoice.paid_amount
            if invoice.balance_amount <= Decimal("0.00"):
                invoice.payment_status = PaymentStatus.PAID
            elif invoice.paid_amount > Decimal("0.00"):
                invoice.payment_status = PaymentStatus.PARTIAL
            else:
                invoice.payment_status = PaymentStatus.UNPAID

    payment.is_cancelled = True
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{payment_id}/print", response_class=HTMLResponse)
def print_payment_voucher(payment_id: int, db: Session = Depends(get_db)):
    """Render a clean, professional, print-ready Indian Receipt / Payment Voucher (A4 / Slip)."""
    payment = db.query(Payment).options(
        joinedload(Payment.firm),
        joinedload(Payment.customer),
        joinedload(Payment.invoice)
    ).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment {payment_id} not found.")

    firm = payment.firm
    customer = payment.customer
    is_receipt = (payment.payment_type == PaymentType.RECEIPT)

    badge_title = "PAYMENT RECEIPT (JAMA VOUCHER)" if is_receipt else "PAYMENT VOUCHER (BHUGTAN VOUCHER)"
    theme_color = "#059669" if is_receipt else "#4f46e5"
    party_title = "Received With Thanks From:" if is_receipt else "Paid In Settlement To:"
    mode_label = (payment.payment_mode.value.upper() if hasattr(payment.payment_mode, "value") else str(payment.payment_mode).upper())

    # Build linked invoice note if any
    bill_ref_html = ""
    if payment.invoice:
        bill_ref_html = f"<div><strong>Settled Against Bill:</strong> #{payment.invoice.invoice_number} (Dated: {payment.invoice.invoice_date})</div>"

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{badge_title} #{payment.payment_number}</title>
    <style>
        @page {{ size: A5 landscape; margin: 12mm; }}
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 13.5px; background: #fff; }}
        .voucher-box {{ border: 2px solid {theme_color}; border-radius: 8px; padding: 20px; max-width: 780px; margin: 0 auto; }}
        .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px; }}
        .title-badge {{ background: {theme_color}; color: white; padding: 5px 14px; border-radius: 4px; font-size: 13px; font-weight: bold; text-transform: uppercase; display: inline-block; }}
        .amount-highlight {{ background: {'#ecfdf5' if is_receipt else '#eef2ff'}; border: 2px solid {theme_color}; border-radius: 6px; padding: 12px 20px; font-size: 24px; font-weight: 800; color: {theme_color}; text-align: center; }}
        .details-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }}
        .footer {{ margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 10px; }}
        .signatory {{ text-align: center; border-top: 1px dashed #64748b; width: 180px; padding-top: 6px; font-size: 12px; color: #334155; }}
        @media print {{
            .no-print {{ display: none; }}
            body {{ padding: 0; }}
            .voucher-box {{ border: 1.5px solid #000; }}
        }}
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 15px; text-align: right; max-width: 780px; margin-left: auto; margin-right: auto;">
        <button onclick="window.print()" style="background: {theme_color}; color: white; border: none; padding: 8px 16px; font-weight: bold; border-radius: 4px; cursor: pointer;">Print / Save as PDF</button>
    </div>

    <div class="voucher-box">
        <div class="header">
            <div>
                <h2 style="margin: 0; color: {theme_color}; font-size: 20px;">{firm.name}</h2>
                <div style="color: #475569; margin-top: 3px; font-size: 12px;">{firm.address or 'Registered Office'}</div>
                <div style="font-weight: 600; margin-top: 3px; font-size: 12px;">GSTIN: <span style="font-family: monospace;">{firm.gstin or 'URP'}</span></div>
            </div>
            <div style="text-align: right;">
                <div class="title-badge">{badge_title}</div>
                <div style="margin-top: 6px; font-size: 13px;"><strong>Voucher No:</strong> {payment.payment_number}</div>
                <div style="font-size: 13px;"><strong>Date:</strong> {payment.payment_date}</div>
            </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px;">
            <div style="font-size: 11.5px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 3px;">
                {party_title}
            </div>
            <div style="font-size: 16px; font-weight: 700; color: #0f172a;">
                {customer.name}
            </div>
            <div style="font-size: 12px; color: #475569; margin-top: 2px;">
                {customer.billing_address or 'Local Walk-in'} {f'• Phone: {customer.phone}' if customer.phone else ''} {f'• GSTIN: {customer.gstin}' if customer.gstin else ''}
            </div>
        </div>

        <div class="details-grid">
            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 12.5px; display: flex; flex-direction: column; gap: 6px;">
                <div><strong>Payment Mode:</strong> <span style="background: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-weight: 600;">{mode_label}</span></div>
                {f"<div><strong>Reference / UTR / Cheque No:</strong> {payment.reference_number}</div>" if payment.reference_number else ""}
                {bill_ref_html}
                <div><strong>Narration:</strong> {payment.notes or ('On-Account Collection' if is_receipt else 'On-Account Supplier Payment')}</div>
            </div>

            <div class="amount-highlight">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 2px;">
                    { 'Amount Received' if is_receipt else 'Amount Paid' }
                </div>
                Rs. {payment.amount:,.2f}
            </div>
        </div>

        <div class="footer">
            <div class="signatory">
                Receiver's / Party Signature
            </div>
            <div class="signatory">
                For <strong>{firm.name}</strong><br/>
                <span style="font-size: 11px; color: #64748b;">(Authorized Signatory)</span>
            </div>
        </div>
    </div>
</body>
</html>
"""
    return html
