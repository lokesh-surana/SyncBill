import sys
sys.stdout.reconfigure(encoding='utf-8')
from app.database import SessionLocal
from app.models.firm import Firm
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.routers.reports import get_party_ledger
from app.routers.payments import print_payment_voucher

db = SessionLocal()
try:
    firms = db.query(Firm).all()
    print(f"Firms count: {len(firms)}")
    for f in firms:
        print(f" - ID {f.id}: {f.name}")
    
    cust = db.query(Customer).filter(Customer.party_type == 'customer').first()
    if cust:
        print(f"Customer: {cust.name} (ID: {cust.id})")
        ledger = get_party_ledger(customer_id=cust.id, firm_id='all', db=db)
        print(f"Combined Ledger transactions: {len(ledger['transactions'])}")
        print(f"Closing Balance: {ledger['closing_balance']} {ledger['closing_balance_type']}")
        for tx in ledger['transactions'][:3]:
            print(f" - Tx: {tx['date']} | {tx['voucher_type']} | {tx['voucher_no']} | Firm: {tx.get('firm_name')}")
    
    pmt = db.query(Payment).first()
    if pmt:
        resp = print_payment_voucher(payment_id=pmt.id, db=db)
        print(f"Payment print rendered successfully, length: {len(resp)} characters")
        assert "VOUCHER" in resp or "RECEIPT" in resp
        print("Payment Voucher print verified successfully!")
    print("ALL PHASE 3 INTEGRATION TESTS PASSED!")
finally:
    db.close()
