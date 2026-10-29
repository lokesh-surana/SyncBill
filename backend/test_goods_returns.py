import sys
import os
from decimal import Decimal
from datetime import date

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from app.models.firm import Firm
from app.models.customer import Customer, PartyType
from app.models.item import Item
from app.models.invoice import Invoice, InvoiceItem, InvoiceType, PaymentStatus
from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate
from app.routers import invoices, customers, reports

def test_goods_returns():
    db = SessionLocal()
    try:
        print("=== 1. Setup Test Firm, Party, and Garment Item ===")
        firm = db.query(Firm).first()
        if not firm:
            firm = Firm(name="Test Garments", gstin="27AABCS1429B1Z", address="Mumbai, MH")
            db.add(firm)
            db.commit()
            db.refresh(firm)

        test_party = db.query(Customer).filter(Customer.name == "Test Return Customer").first()
        if not test_party:
            test_party = Customer(
                name="Test Return Customer",
                phone="9876543210",
                gstin="27AABCT0000A1Z",
                party_type=PartyType.CUSTOMER,
                opening_balance=Decimal("0.00"),
                state_code="27",
            )
            db.add(test_party)
            db.commit()
            db.refresh(test_party)

        test_item = db.query(Item).filter(Item.name == "Test Cotton Shirt 40").first()
        if not test_item:
            test_item = Item(
                name="Test Cotton Shirt 40",
                item_code="TCS-40",
                hsn_code="6205",
                current_stock=Decimal("100.000"),
                retail_rate=Decimal("500.00"),
                gst_rate=Decimal("5.00"),
            )
            db.add(test_item)
            db.commit()
            db.refresh(test_item)

        initial_stock = test_item.current_stock
        print(f"Initial Item Stock: {initial_stock} Pcs")

        print("\n=== 2. Create Original Sales Invoice (Sell 10 Pcs @ Rs 500) ===")
        sale_payload = InvoiceCreate(
            firm_id=firm.id,
            customer_id=test_party.id,
            invoice_type=InvoiceType.SALES,
            invoice_date=date.today(),
            place_of_supply="27",
            paid_amount=Decimal("0.00"),
            items=[
                InvoiceItemCreate(
                    item_id=test_item.id,
                    item_name=test_item.name,
                    hsn_code=test_item.hsn_code,
                    size="40",
                    color="Blue",
                    quantity=Decimal("10.000"),
                    rate=Decimal("500.00"),
                    gst_rate=Decimal("5.00"),
                )
            ]
        )
        sale_inv = invoices.create_invoice(sale_payload, db)
        print(f"Created Sale Bill: #{sale_inv.invoice_number}, Grand Total: Rs. {sale_inv.grand_total}")

        # Check stock after sale
        db.refresh(test_item)
        print(f"Stock after Sale: {test_item.current_stock} Pcs (Expected {initial_stock - 10})")
        assert test_item.current_stock == initial_stock - 10, "Stock was not decremented on sale!"

        # Check Party Outstanding
        bal_info = customers.get_customer_outstanding(test_party.id, firm.id, db)
        print(f"Party Outstanding after Sale: {bal_info['balance_formatted']}")

        print("\n=== 3. Query Returnable Items for this Sale Bill ===")
        ret_info = invoices.get_returnable_items(sale_inv.id, db)
        print(f"Original Bill No: {ret_info['invoice_number']}")
        print(f"Items Count: {len(ret_info['items'])}, Returnable Qty: {ret_info['items'][0]['returnable_quantity']} Pcs")
        assert ret_info['items'][0]['returnable_quantity'] == 10.0, "Returnable quantity should be 10.0"

        print("\n=== 4. Create Sales Return Voucher (Credit Note / F12) for 3 Pcs ===")
        cn_payload = InvoiceCreate(
            firm_id=firm.id,
            customer_id=test_party.id,
            invoice_type=InvoiceType.CREDIT_NOTE,
            invoice_date=date.today(),
            original_invoice_id=sale_inv.id,
            original_invoice_number=sale_inv.invoice_number,
            return_reason="Defective / Damaged Piece",
            place_of_supply="27",
            credit_amount=Decimal("1575.00"),
            items=[
                InvoiceItemCreate(
                    item_id=test_item.id,
                    item_name=test_item.name,
                    hsn_code=test_item.hsn_code,
                    size="40",
                    color="Blue",
                    quantity=Decimal("3.000"),
                    rate=Decimal("500.00"),
                    gst_rate=Decimal("5.00"),
                )
            ]
        )
        cn_inv = invoices.create_invoice(cn_payload, db)
        print(f"Created Credit Note: #{cn_inv.invoice_number}, Total Credit: Rs. {cn_inv.grand_total}")
        assert cn_inv.invoice_number.startswith("CN-"), "Credit note prefix should be CN-"

        # Check stock after credit note
        db.refresh(test_item)
        print(f"Stock after Credit Note: {test_item.current_stock} Pcs (Expected {initial_stock - 7})")
        assert test_item.current_stock == initial_stock - 7, "Stock was not restored on Credit Note!"

        print("\n=== 5. Query Remaining Returnable Items on Original Bill ===")
        ret_info2 = invoices.get_returnable_items(sale_inv.id, db)
        print(f"Already Returned: {ret_info2['items'][0]['already_returned_quantity']} Pcs")
        print(f"Remaining Returnable: {ret_info2['items'][0]['returnable_quantity']} Pcs (Expected 7.0)")
        assert ret_info2['items'][0]['already_returned_quantity'] == 3.0, "Already returned should be 3.0"
        assert ret_info2['items'][0]['returnable_quantity'] == 7.0, "Remaining returnable should be 7.0"

        print("\n=== 6. Verify Customer Outstanding Reduction in Ledger ===")
        bal_info2 = customers.get_customer_outstanding(test_party.id, firm.id, db)
        print(f"Customer Outstanding after Credit Note: {bal_info2['balance_formatted']}")
        # Customer outstanding must decrease by exactly the Credit Note grand total
        expected_balance = bal_info['net_balance'] - float(cn_inv.grand_total)
        assert bal_info2['net_balance'] == expected_balance, f"Expected {expected_balance} but got {bal_info2['net_balance']}"

        print("\n=== 7. Verify Party Ledger Transactions ===")
        ledger = reports.get_party_ledger(test_party.id, firm.id, None, None, db)
        print(f"Total Transactions in Ledger: {len(ledger['transactions'])}")
        for t in ledger['transactions']:
            print(f"  • [{t['date']}] {t['voucher_type']} #{t['voucher_no']} | Debit: Rs.{t['debit']} | Credit: Rs.{t['credit']} | Bal: Rs.{t['running_balance']} {t['balance_type']} | Narration: {t['narration']}")

        cn_tx = [t for t in ledger['transactions'] if t['voucher_type'] == "Credit Note (Sale Return)"]
        assert len(cn_tx) >= 1, "Credit Note must appear in party ledger transactions"
        assert cn_tx[0]['credit'] == float(cn_inv.grand_total), "Credit amount must match Credit Note grand total"

        print("\n🎉 ALL GOODS RETURN TESTS PASSED PERFECTLY! 🎉\n")
    finally:
        db.close()

if __name__ == "__main__":
    test_goods_returns()
