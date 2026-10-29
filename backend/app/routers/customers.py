from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from app.database import get_db
from app.models.customer import Customer, PartyType
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter(prefix="/customers", tags=["Customers & Vendors"])


@router.get("/", response_model=List[CustomerResponse])
def get_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(2000, ge=1, le=10000),
    search: Optional[str] = Query(None, description="Search by name, GSTIN, or phone"),
    party_type: Optional[PartyType] = Query(None, description="Filter by customer, vendor, or both"),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    """List customers/vendors with optional filters, sorted alphabetically."""
    query = db.query(Customer)
    if active_only:
        query = query.filter(Customer.is_active == True)
    if party_type:
        query = query.filter(Customer.party_type == party_type)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Customer.name.ilike(search_filter))
            | (Customer.gstin.ilike(search_filter))
            | (Customer.phone.ilike(search_filter))
            | (Customer.billing_address.ilike(search_filter))
        )
    return query.order_by(func.lower(Customer.name).asc()).offset(skip).limit(limit).all()


@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(customer_in: CustomerCreate, db: Session = Depends(get_db)):
    """Create a new customer or vendor in the ledger."""
    if customer_in.gstin:
        existing = db.query(Customer).filter(Customer.gstin == customer_in.gstin).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Party with GSTIN '{customer_in.gstin}' already exists.",
            )

    customer = Customer(**customer_in.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """Fetch details of a single customer/vendor by ID."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with id {customer_id} not found.",
        )
    return customer


@router.get("/{customer_id}/outstanding")
def get_customer_outstanding(
    customer_id: int,
    firm_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Fetch live outstanding balance (Receivable/Payable) for the billing banner."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with id {customer_id} not found.",
        )

    from app.models.invoice import Invoice, InvoiceType
    from app.models.payment import Payment, PaymentType

    base_opening = float(customer.opening_balance or 0.0)

    inv_q = db.query(Invoice).filter(Invoice.customer_id == customer_id, Invoice.is_cancelled == False)
    if firm_id and str(firm_id).lower() != "all":
        inv_q = inv_q.filter(Invoice.firm_id == firm_id)
    invoices = inv_q.order_by(Invoice.invoice_date.desc()).all()

    pmt_q = db.query(Payment).filter(Payment.customer_id == customer_id, Payment.is_cancelled == False)
    if firm_id and str(firm_id).lower() != "all":
        pmt_q = pmt_q.filter(Payment.firm_id == firm_id)
    payments = pmt_q.all()

    total_sales = sum(float(inv.grand_total) for inv in invoices if inv.invoice_type == InvoiceType.SALES)
    total_purchases = sum(float(inv.grand_total) for inv in invoices if inv.invoice_type == InvoiceType.PURCHASE)
    total_credit_notes = sum(float(inv.grand_total) for inv in invoices if inv.invoice_type == InvoiceType.CREDIT_NOTE)
    total_debit_notes = sum(float(inv.grand_total) for inv in invoices if inv.invoice_type == InvoiceType.DEBIT_NOTE)
    total_receipts = sum(float(p.amount) for p in payments if p.payment_type == PaymentType.RECEIPT)
    total_payments = sum(float(p.amount) for p in payments if p.payment_type == PaymentType.PAYMENT)

    is_vendor = (customer.party_type == PartyType.VENDOR)
    if is_vendor:
        net_balance = -(base_opening + total_purchases - total_debit_notes - total_payments)
        balance_label = "Payable Amount"
    else:
        net_balance = base_opening + total_sales - total_credit_notes - total_receipts
        balance_label = "Outstanding" if net_balance >= 0 else "Credit (Advance)"

    unpaid_count = sum(
        1 for inv in invoices 
        if ((inv.invoice_type == InvoiceType.PURCHASE if is_vendor else inv.invoice_type == InvoiceType.SALES) and inv.balance_amount > 0)
    )
    last_bill = invoices[0].invoice_date.strftime("%d/%m/%Y") if invoices and invoices[0].invoice_date else "-"

    return {
        "customer_id": customer.id,
        "name": customer.name,
        "gstin": customer.gstin,
        "phone": customer.phone,
        "billing_address": customer.billing_address,
        "party_type": customer.party_type.value if hasattr(customer.party_type, "value") else str(customer.party_type),
        "net_balance": round(net_balance, 2),
        "balance_formatted": f"₹{abs(net_balance):,.2f}",
        "balance_label": balance_label,
        "is_debit": net_balance > 0,
        "unpaid_bills_count": unpaid_count,
        "last_bill_date": last_bill,
    }


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, customer_in: CustomerUpdate, db: Session = Depends(get_db)):
    """Update details of an existing customer or vendor."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with id {customer_id} not found.",
        )

    update_data = customer_in.model_dump(exclude_unset=True)
    if "gstin" in update_data and update_data["gstin"] != customer.gstin:
        existing = (
            db.query(Customer)
            .filter(Customer.gstin == update_data["gstin"], Customer.id != customer_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Party with GSTIN '{update_data['gstin']}' already exists.",
            )

    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_200_OK)
def delete_customer(
    customer_id: int,
    hard_delete: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Soft-delete party by default, or permanently delete if hard_delete=True."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with id {customer_id} not found.",
        )

    if hard_delete:
        db.delete(customer)
    else:
        customer.is_active = False

    db.commit()
    return {"message": f"Customer {customer_id} {'deleted' if hard_delete else 'deactivated'} successfully."}


@router.get("/{customer_id}/official-pdf")
def get_customer_official_pdf(customer_id: int, db: Session = Depends(get_db)):
    """Retrieve the authentic Accurate .rpt PDF link from Google Drive."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with id {customer_id} not found."
        )
    return {
        "customer_id": customer.id,
        "name": customer.name,
        "official_pdf_url": customer.official_pdf_url,
        "official_pdf_drive_id": customer.official_pdf_drive_id,
        "pdf_updated_at": customer.pdf_updated_at.isoformat() if customer.pdf_updated_at else None,
        "is_available": bool(customer.official_pdf_url)
    }
