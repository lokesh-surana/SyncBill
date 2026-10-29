import json
import urllib.request
import urllib.error
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session, joinedload
from typing import Optional, Dict, Any
from decimal import Decimal

from app.database import get_db
from app.models.firm import Firm
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceItem
from app.models.payment import Payment
from app.routers.customers import get_customer_outstanding

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Free Automation"])

BRIDGE_URL = "http://127.0.0.1:3001"


def query_bridge(endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None, timeout: int = 5) -> Dict[str, Any]:
    url = f"{BRIDGE_URL}{endpoint}"
    req_data = None
    headers = {"Content-Type": "application/json"}
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            return json.loads(error_body)
        except Exception:
            raise HTTPException(status_code=e.code, detail=f"WhatsApp Bridge Error: {e.reason}")
    except urllib.error.URLError:
        return {
            "bridge_online": False,
            "connected": False,
            "status": "BRIDGE_OFFLINE",
            "message": "WhatsApp Bridge server is offline. Please start it using START_WHATSAPP_BRIDGE.bat",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
def get_whatsapp_status():
    """Returns the current connection status of the WhatsApp Web Bridge and QR code if scanning is required."""
    res = query_bridge("/status")
    if "bridge_online" in res and not res["bridge_online"]:
        return res
    return {
        "bridge_online": True,
        "connected": res.get("connected", False),
        "status": res.get("status", "UNKNOWN"),
        "phone": res.get("phone"),
        "name": res.get("name"),
        "qr_image": res.get("qrImage"),
        "qr_view_url": f"{BRIDGE_URL}/qr-view",
        "last_updated": res.get("lastUpdated"),
        "error": res.get("error"),
    }


@router.post("/send-invoice/{invoice_id}")
def send_invoice_whatsapp(
    invoice_id: int,
    custom_phone: Optional[str] = Query(None, description="Optional override phone number"),
    db: Session = Depends(get_db),
):
    """Formats and sends a complete GST Tax Invoice directly to customer's WhatsApp."""
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.customer), joinedload(Invoice.firm), joinedload(Invoice.items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    target_phone = custom_phone or (invoice.customer.phone if invoice.customer else None)
    if not target_phone:
        raise HTTPException(status_code=400, detail="Customer has no phone number recorded. Please specify a phone number.")

    firm_name = invoice.firm.name if invoice.firm else "SyncBill Store"
    cust_name = invoice.customer.name if invoice.customer else "Valued Customer"

    # Compute current outstanding
    outstanding_str = "₹0.00"
    if invoice.customer:
        bal_info = get_customer_outstanding(invoice.customer.id, invoice.firm_id, db)
        outstanding_str = bal_info.get("balance_formatted", "₹0.00")

    # Item summary
    items_lines = []
    for it in invoice.items[:8]:
        size_str = f" ({it.size})" if it.size else ""
        items_lines.append(f"• {it.item_name}{size_str} x {int(it.quantity) if it.quantity % 1 == 0 else it.quantity} @ ₹{it.rate:.2f}")
    if len(invoice.items) > 8:
        items_lines.append(f"• ... and {len(invoice.items) - 8} more item(s)")

    items_block = "\n".join(items_lines) if items_lines else "• Garment Items"

    # Compose WhatsApp message
    msg = (
        f"🧾 *TAX INVOICE — {firm_name}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*Bill No:* #{invoice.invoice_number}\n"
        f"*Date:* {invoice.invoice_date.strftime('%d/%m/%Y')}\n"
        f"*Customer:* {cust_name}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*Items:*\n"
        f"{items_block}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*Grand Total:* ₹{invoice.grand_total:,.2f}\n"
        f"*Amount Paid:* ₹{invoice.paid_amount:,.2f}\n"
        f"*Bill Balance:* ₹{invoice.balance_amount:,.2f}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*Total Account Balance:* {outstanding_str}\n\n"
        f"🙏 *Thank you for your business!*\n"
        f"_{invoice.firm.address if invoice.firm and invoice.firm.address else ''}_\n"
    )

    res = query_bridge("/send-text", method="POST", data={"phone": target_phone, "message": msg})
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to send WhatsApp message"))

    return {
        "success": True,
        "message": f"Invoice #{invoice.invoice_number} sent successfully to {target_phone} via WhatsApp!",
        "to": target_phone,
        "message_id": res.get("message_id"),
    }


@router.post("/send-payment/{payment_id}")
def send_payment_receipt_whatsapp(
    payment_id: int,
    custom_phone: Optional[str] = Query(None, description="Optional override phone number"),
    db: Session = Depends(get_db),
):
    """Sends a payment receipt acknowledgement to customer via WhatsApp."""
    payment = (
        db.query(Payment)
        .options(joinedload(Payment.customer), joinedload(Payment.firm))
        .filter(Payment.id == payment_id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment voucher not found")

    target_phone = custom_phone or (payment.customer.phone if payment.customer else None)
    if not target_phone:
        raise HTTPException(status_code=400, detail="Party has no phone number recorded.")

    firm_name = payment.firm.name if payment.firm else "SyncBill Store"
    party_name = payment.customer.name if payment.customer else "Valued Party"

    # Compute remaining balance
    bal_str = "₹0.00"
    if payment.customer:
        bal_info = get_customer_outstanding(payment.customer.id, payment.firm_id, db)
        bal_str = bal_info.get("balance_formatted", "₹0.00")

    ref_line = f"\n*Ref / Cheque No:* {payment.reference_number}" if payment.reference_number else ""

    msg = (
        f"💳 *PAYMENT RECEIPT — {firm_name}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*Receipt No:* #{payment.payment_number}\n"
        f"*Date:* {payment.payment_date.strftime('%d/%m/%Y')}\n"
        f"*Party:* {party_name}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*Amount Received:* ₹{payment.amount:,.2f}\n"
        f"*Payment Mode:* {payment.payment_mode.upper()}{ref_line}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*Current Outstanding Balance:* {bal_str}\n\n"
        f"🙏 *Thank you for your payment!*"
    )

    res = query_bridge("/send-text", method="POST", data={"phone": target_phone, "message": msg})
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to send WhatsApp message"))

    return {
        "success": True,
        "message": f"Payment receipt #{payment.payment_number} sent to {target_phone} via WhatsApp!",
        "to": target_phone,
        "message_id": res.get("message_id"),
    }


@router.post("/send-custom")
def send_custom_whatsapp(
    phone: str = Body(..., embed=True),
    message: str = Body(..., embed=True),
):
    """Sends any custom message to a given phone number."""
    res = query_bridge("/send-text", method="POST", data={"phone": phone, "message": message})
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to send WhatsApp message"))
    return res
