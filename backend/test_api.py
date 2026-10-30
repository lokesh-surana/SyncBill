"""
test_api.py — End-to-end integration test for SyncBill FastAPI endpoints.
Tests Firm, Item, and Customer CRUD via TestClient.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def run_tests():
    print("Testing SyncBill API...")

    # 1. Root & Health
    r = client.get("/")
    assert r.status_code == 200, f"Root failed: {r.text}"
    print("[PASS] Root endpoint (/)")

    r = client.get("/health")
    assert r.status_code == 200, f"Health failed: {r.text}"
    print("[PASS] Health endpoint (/health)")

    # 2. Firm CRUD
    firm_payload = {
        "name": "Demo Enterprise Pvt Ltd",
        "gstin": "27TESTF1234F1Z1",
        "address": "101 Tech Hub, Pune, Maharashtra",
        "fy_start": "2024-04-01",
        "fy_end": "2025-03-31",
        "is_active": True,
    }
    r = client.post("/api/v1/firms/", json=firm_payload)
    if r.status_code == 400 and "already exists" in r.text:
        # If already created in a previous test run
        r = client.get("/api/v1/firms/")
        firm_id = r.json()[0]["id"]
        print(f"[PASS] Firm already existed, reused ID={firm_id}")
    else:
        assert r.status_code == 201, f"Create firm failed: {r.text}"
        firm_id = r.json()["id"]
        print(f"[PASS] Created Firm (ID={firm_id})")

    # 3. Item CRUD
    item_payload = {
        "name": "Dell OptiPlex Desktop",
        "item_code": "DELL-OPT-001",
        "description": "Core i7, 16GB RAM, 512GB SSD",
        "hsn_code": "84713010",
        "gst_rate": "18.00",
        "primary_uom": "Pcs",
        "purchase_rate": "45000.00",
        "wholesale_rate": "52000.00",
        "retail_rate": "58000.00",
        "mrp": "62000.00",
        "current_stock": "25.000",
        "reorder_level": "5.000",
        "is_service": False,
        "is_active": True,
    }
    r = client.post("/api/v1/items/", json=item_payload)
    if r.status_code == 400 and "already exists" in r.text:
        r = client.get("/api/v1/items/?search=DELL-OPT-001")
        item_id = r.json()[0]["id"]
        print(f"[PASS] Item already existed, reused ID={item_id}")
    else:
        assert r.status_code == 201, f"Create item failed: {r.text}"
        item_id = r.json()["id"]
        print(f"[PASS] Created Item (ID={item_id})")

    # 4. Partial update (PATCH) on Item
    patch_res = client.patch(f"/api/v1/items/{item_id}", json={"retail_rate": "59500.00"})
    assert patch_res.status_code == 200
    assert float(patch_res.json()["retail_rate"]) == 59500.00
    print(f"[PASS] Updated Item ID={item_id} (retail_rate=59500.00)")

    # 5. Customer / Vendor CRUD
    customer_payload = {
        "name": "Apex Electronics Ltd",
        "gstin": "27AAACA1234A1Z5",
        "party_type": "customer",
        "phone": "+91 9876543210",
        "email": "billing@apexelectronics.com",
        "billing_address": "Shop 4, Wholesale Textile Market, Mumbai",
        "state_code": "27",
        "credit_limit": "200000.00",
        "credit_days": 30,
        "opening_balance": "0.00",
        "is_active": True,
    }
    r = client.post("/api/v1/customers/", json=customer_payload)
    if r.status_code == 400 and "already exists" in r.text:
        r = client.get("/api/v1/customers/?search=Apex")
        customer_id = r.json()[0]["id"]
        print(f"[PASS] Customer already existed, reused ID={customer_id}")
    else:
        assert r.status_code == 201, f"Create customer failed: {r.text}"
        customer_id = r.json()["id"]
        print(f"[PASS] Created Customer (ID={customer_id})")

    # 6. List and filter verification
    items_list = client.get("/api/v1/items/?limit=5").json()
    assert len(items_list) >= 1
    print(f"[PASS] List items returned {len(items_list)} record(s)")

    customers_list = client.get("/api/v1/customers/?party_type=customer").json()
    assert len(customers_list) >= 1
    print(f"[PASS] List customers returned {len(customers_list)} record(s)")

    # 7. Test Item with default 5% GST rate
    cotton_item_payload = {
        "name": "Cotton Fabric Roll",
        "item_code": "FAB-COT-05",
        "description": "100% Pure Organic Cotton 5% GST",
        "hsn_code": "5208",
        # gst_rate omitted to test 5% default
        "primary_uom": "Mtr",
        "purchase_rate": "120.00",
        "wholesale_rate": "150.00",
        "retail_rate": "180.00",
        "current_stock": "100.000",
    }
    r = client.post("/api/v1/items/", json=cotton_item_payload)
    if r.status_code == 400 and "already exists" in r.text:
        r = client.get("/api/v1/items/?search=FAB-COT-05")
        cotton_item = r.json()[0]
    else:
        assert r.status_code == 201
        cotton_item = r.json()

    assert float(cotton_item["gst_rate"]) == 5.00, f"Expected 5.00 GST rate, got {cotton_item['gst_rate']}"
    cotton_item_id = cotton_item["id"]
    initial_stock = float(cotton_item["current_stock"])
    print(f"[PASS] Item created with default 5% GST rate ({cotton_item['gst_rate']}%)")

    # 8. Test Invoice creation with 5% GST and stock deduction
    invoice_payload = {
        "firm_id": firm_id,
        "customer_id": customer_id,
        "invoice_type": "sales",
        "paid_amount": "500.00",
        "items": [
            {
                "item_id": cotton_item_id,
                "item_name": cotton_item["name"],
                "hsn_code": cotton_item["hsn_code"],
                "quantity": "10.000",
                "uom": "Mtr",
                "rate": "200.00",
                "discount_percent": "0.00",
                "gst_rate": "5.00",  # 5% tax
            }
        ]
    }
    r = client.post("/api/v1/invoices/", json=invoice_payload)
    assert r.status_code == 201, f"Create invoice failed: {r.text}"
    inv = r.json()
    inv_id = inv["id"]

    # Calculation checks:
    # 10 Mtr * 200.00 = 2000.00 taxable
    # Intra-state (27 to 27): CGST = 2.5% = 50.00, SGST = 2.5% = 50.00, IGST = 0.00
    # Total tax = 100.00
    # Grand total = 2100.00
    # Paid = 500.00, Balance = 1600.00, PaymentStatus = partial
    assert float(inv["subtotal"]) == 2000.00
    assert float(inv["total_cgst"]) == 50.00
    assert float(inv["total_sgst"]) == 50.00
    assert float(inv["total_igst"]) == 0.00
    assert float(inv["total_tax"]) == 100.00
    assert float(inv["grand_total"]) == 2100.00
    assert float(inv["paid_amount"]) == 500.00
    assert float(inv["balance_amount"]) == 1600.00
    assert inv["payment_status"] == "partial"
    print(f"[PASS] Invoice #{inv['invoice_number']} created: Subtotal=2000, CGST=50, SGST=50 (5% GST total), GrandTotal=2100")

    # Check stock decreased by 10
    updated_item = client.get(f"/api/v1/items/{cotton_item_id}").json()
    assert float(updated_item["current_stock"]) == initial_stock - 10.0
    print(f"[PASS] Inventory automatically deducted: {initial_stock} -> {updated_item['current_stock']}")

    # 9. Test Invoice Cancellation & Stock Restoration
    cancel_res = client.post(f"/api/v1/invoices/{inv_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["is_cancelled"] is True
    restored_item = client.get(f"/api/v1/items/{cotton_item_id}").json()
    assert float(restored_item["current_stock"]) == initial_stock
    print(f"[PASS] Invoice cancelled and inventory restored to {restored_item['current_stock']}")

    # 10. Test Payments & Receipt Settlement
    # Create an active invoice to settle
    active_inv_res = client.post("/api/v1/invoices/", json={
        "firm_id": firm_id,
        "customer_id": customer_id,
        "invoice_type": "sales",
        "paid_amount": "0.00",
        "items": [
            {
                "item_name": "Premium Cotton Saree",
                "hsn_code": "5208",
                "quantity": "2.000",
                "uom": "Pcs",
                "rate": "1000.00",
                "discount_percent": "0.00",
                "gst_rate": "5.00",
            }
        ]
    })
    assert active_inv_res.status_code == 201
    active_inv = active_inv_res.json()
    active_inv_id = active_inv["id"]
    # 2 * 1000 = 2000 + 5% GST (100) = 2100 total
    assert float(active_inv["grand_total"]) == 2100.00
    assert float(active_inv["balance_amount"]) == 2100.00
    assert active_inv["payment_status"] == "unpaid"
    print(f"[PASS] Active Invoice created for payment test (Grand Total: {active_inv['grand_total']})")

    # Payment 1: UPI receipt of 1000
    p1_res = client.post("/api/v1/payments/", json={
        "firm_id": firm_id,
        "customer_id": customer_id,
        "invoice_id": active_inv_id,
        "payment_type": "receipt",
        "payment_mode": "upi",
        "amount": "1000.00",
        "reference_number": "UPI-UTR-987654321012",
        "notes": "Advance via Google Pay",
    })
    assert p1_res.status_code == 201
    p1 = p1_res.json()
    print(f"[PASS] Recorded UPI Receipt {p1['payment_number']} for Rs.{p1['amount']}")

    # Verify invoice status is now partial with balance 1100
    inv_after_p1 = client.get(f"/api/v1/invoices/{active_inv_id}").json()
    assert float(inv_after_p1["paid_amount"]) == 1000.00
    assert float(inv_after_p1["balance_amount"]) == 1100.00
    assert inv_after_p1["payment_status"] == "partial"
    print(f"[PASS] Invoice balance updated to Rs.{inv_after_p1['balance_amount']} (Status: partial)")

    # Payment 2: Cash receipt of 1100 to fully settle
    p2_res = client.post("/api/v1/payments/", json={
        "firm_id": firm_id,
        "customer_id": customer_id,
        "invoice_id": active_inv_id,
        "payment_type": "receipt",
        "payment_mode": "cash",
        "amount": "1100.00",
        "notes": "Final settlement in cash",
    })
    assert p2_res.status_code == 201
    p2 = p2_res.json()
    p2_id = p2["id"]

    # Verify invoice status is now fully paid
    inv_after_p2 = client.get(f"/api/v1/invoices/{active_inv_id}").json()
    assert float(inv_after_p2["paid_amount"]) == 2100.00
    assert float(inv_after_p2["balance_amount"]) == 0.00
    assert inv_after_p2["payment_status"] == "paid"
    print(f"[PASS] Invoice fully settled! (Status: paid, Balance: Rs.0.00)")

    # Cancel payment 2 and verify reversion
    p2_cancel_res = client.post(f"/api/v1/payments/{p2_id}/cancel")
    assert p2_cancel_res.status_code == 200
    inv_after_cancel = client.get(f"/api/v1/invoices/{active_inv_id}").json()
    assert float(inv_after_cancel["paid_amount"]) == 1000.00
    assert float(inv_after_cancel["balance_amount"]) == 1100.00
    assert inv_after_cancel["payment_status"] == "partial"
    print(f"[PASS] Payment cancelled: Invoice balance reverted back to Rs.{inv_after_cancel['balance_amount']}")

    # 11. Test Offline-First Sync Engine (Push & Pull)
    sync_push_payload = {
        "firm_id": firm_id,
        "device_id": "pos-counter-terminal-01",
        "items": [
            {
                "sync_id": "sync-item-uuid-101",
                "name": "Offline Synced Silk Ribbon",
                "item_code": "OFF-SLK-101",
                "gst_rate": "5.00",
                "primary_uom": "Mtr",
                "retail_rate": "60.00",
                "current_stock": "50.000",
            }
        ],
        "customers": [
            {
                "sync_id": "sync-cust-uuid-201",
                "name": "Offline Walkin Retail Customer",
                "party_type": "customer",
                "phone": "+91 9123456789",
                "state_code": "27",
            }
        ],
        "invoices": [
            {
                "sync_id": "sync-inv-uuid-301",
                "firm_id": firm_id,
                "customer_id": customer_id,
                "invoice_type": "sales",
                "paid_amount": "100.00",
                "items": [
                    {
                        "item_name": "Offline Synced Silk Ribbon",
                        "hsn_code": "5208",
                        "quantity": "5.000",
                        "uom": "Mtr",
                        "rate": "60.00",
                        "gst_rate": "5.00",
                    }
                ]
            }
        ],
        "payments": [
            {
                "sync_id": "sync-pmt-uuid-401",
                "firm_id": firm_id,
                "customer_id": customer_id,
                "payment_type": "receipt",
                "payment_mode": "upi",
                "amount": "100.00",
                "reference_number": "UPI-SYNC-998877",
            }
        ]
    }

    push_res = client.post("/api/v1/sync/push", json=sync_push_payload)
    assert push_res.status_code == 200, f"Sync push failed: {push_res.text}"
    push_data = push_res.json()
    assert push_data["status"] == "success"
    assert "sync-item-uuid-101" in push_data["id_mappings"]["items"]
    assert "sync-cust-uuid-201" in push_data["id_mappings"]["customers"]
    assert "sync-inv-uuid-301" in push_data["id_mappings"]["invoices"]
    assert "sync-pmt-uuid-401" in push_data["id_mappings"]["payments"]
    print(f"[PASS] Sync Push successful: Mapped {len(push_data['id_mappings'])} entity types to server IDs")

    # Idempotency test: Re-push same payload, must not error and return same mappings
    push_res_2 = client.post("/api/v1/sync/push", json=sync_push_payload)
    assert push_res_2.status_code == 200
    assert push_res_2.json()["id_mappings"]["invoices"]["sync-inv-uuid-301"] == push_data["id_mappings"]["invoices"]["sync-inv-uuid-301"]
    print("[PASS] Sync Push idempotency verified: Duplicate offline batches safely merged without duplicate invoices")

    # Test Sync Pull
    pull_res = client.post("/api/v1/sync/pull", json={"firm_id": firm_id})
    assert pull_res.status_code == 200
    pull_data = pull_res.json()
    assert len(pull_data["items"]) >= 1
    assert len(pull_data["customers"]) >= 1
    assert len(pull_data["invoices"]) >= 1
    print(f"[PASS] Sync Pull successful: Retrieved {len(pull_data['items'])} items, {len(pull_data['invoices'])} invoices")

    # 12. Test Reports & Analytics (Dashboard KPIs, GSTR-1, Low Stock)
    dash_res = client.get(f"/api/v1/reports/dashboard?firm_id={firm_id}")
    assert dash_res.status_code == 200
    kpis = dash_res.json()
    assert kpis["total_sales"] > 0
    assert kpis["total_tax_collected"] > 0
    assert "cash_collected" in kpis
    assert "upi_collected" in kpis
    print(f"[PASS] Dashboard KPIs fetched: Sales=Rs.{kpis['total_sales']}, Tax=Rs.{kpis['total_tax_collected']}, Receivables=Rs.{kpis['total_receivables']}")

    # GSTR-1 Tax Filing Report
    gstr1_res = client.get(f"/api/v1/reports/gstr1?firm_id={firm_id}")
    assert gstr1_res.status_code == 200
    gstr1 = gstr1_res.json()
    assert "b2b_invoices" in gstr1
    assert "b2c_invoices" in gstr1
    assert "hsn_summary" in gstr1
    assert len(gstr1["hsn_summary"]) >= 1
    print(f"[PASS] GSTR-1 Report generated: {len(gstr1['b2b_invoices'])} B2B, {len(gstr1['b2c_invoices'])} B2C, {len(gstr1['hsn_summary'])} HSN items")

    # Low Stock Alerts
    stock_res = client.get("/api/v1/reports/low-stock")
    assert stock_res.status_code == 200
    print(f"[PASS] Low stock alerts report generated: {len(stock_res.json())} item(s) flagged")

    # 13. Test HTML Printable Tax Invoice
    print_res = client.get(f"/api/v1/invoices/{inv_id}/print")
    assert print_res.status_code == 200
    assert "TAX INVOICE" in print_res.text
    assert "GSTIN:" in print_res.text
    assert "Rs." in print_res.text
    print(f"[PASS] Printable GST Tax Invoice HTML successfully rendered for Invoice ID={inv_id}")

    print("\nALL API TESTS (INVOICING, 5% GST, PAYMENTS, SYNC, REPORTS & PRINTING) PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_tests()



