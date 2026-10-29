# SyncBill ERP

A high-performance, offline-first Indian GST Billing, Inventory Management, and POS ERP system for MSMEs (Garments & Apparel Retail/Wholesale), built with Tally Prime / Accurate ERP aesthetics.

---

## 🚀 Live Running Services

Both services are currently active:

- **Frontend POS & ERP**: [http://localhost:5173/](http://localhost:5173/)
- **Backend API**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Interactive Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🏢 Operating Entities (Multi-Firm Architecture)

- **APEX APPARELS & TEXTILES** (`GSTIN: 27AABCS1429B1Z1`) — Wholesale Market, Pune, Maharashtra
- **METRO CREATIONS** (`GSTIN: 27AACCK0000A1Z5`) — Retail Outlet, Pune, Maharashtra

---

## 🏗️ Core Modules & Features

### 1. Financial Year Switcher (Change Financial Year)
- Quick toggle between Indian Financial Years in the header:
  - **FY 2026-27 (Current Year)**: `01/04/2026` to `31/03/2027`
  - **FY 2025-26 (Previous Year)**: `01/04/2025` to `31/03/2026`
  - **FY 2024-25 (Archived Year)**: `01/04/2024` to `31/03/2025`
  - **FY 2023-24 (Archived Year)**: `01/04/2023` to `31/03/2024`
  - **All Financial Years (Complete History)**
- Instantly re-filters the **Sales Register**, **Purchase Register**, **GSTR-1 Tax Reports**, and **Executive Dashboard** to that financial year.
- Allows viewing, inspecting, and printing past bills across any previous financial year!

### 2. Sale Bill (F8 / Sales Voucher)
- Customer / Buyer selection with auto-state detection (Place of Supply `27` Maharashtra).
- Keyboard-friendly high-density spreadsheet billing grid.
- All products default to **5% GST** (Intra-state: CGST 2.5% + SGST 2.5%, Inter-state: IGST 5.0%).
- Automatic stock deduction upon invoice generation.
- Instant 1-click **A4 GST Tax Invoice** printable format with terms & conditions.

### 3. Purchase Bill (F9 / Purchase Voucher)
- Vendor / Supplier selection with GSTIN validation.
- Supplier Invoice Number & Bill Date tracking.
- Line items with HSN codes, dual UOMs, and 5% Input Tax Credit (ITC).
- Automatic stock addition/incrementation into warehouse inventory.
- Instant 1-click **Purchase Bill / Inward Voucher** printable format.

### 4. Sales Register & Daybook
- Displays all historical and current sales bills for the selected Financial Year.
- Real-time search filter by invoice number or customer name.
- Summary metrics: Total Sales Turnover, Total 5% GST Collected, Invoices Count.
- Direct **Print Tax Invoice** button on every historical voucher.

### 5. Purchase Register & Daybook
- Displays all historical and current supplier bills for the selected Financial Year.
- Real-time search filter by bill number or supplier name.
- Summary metrics: Total Purchases, Input Tax Credit (ITC ₹), Total Supplier Bills.
- Direct **Print Purchase Bill** button on every historical voucher.

### 6. Accurate ERP Historical Data Migration
- Fully parsed and imported from `accurate.zip`:
  - **216+ Real Sales Invoices** across FY 2025-26 and FY 2026-27
  - **86+ Real Purchase Bills** across FY 2025-26 and FY 2026-27
  - **1,000+ Apparel & Garments Products** (`BE1143(20/26)VANESIS`, `BOYS JACKET`, `T-SHIRTS`, `508/1037`, etc.) with rates, stocks, and 5% GST
  - **98 Real Customer & Supplier Accounts** (`ROHAL COLLECTION`, `Best N Less`, `ROYAL TRADING COMPANY`, `IYER ASSOCIATES`, etc.)

### 7. GSTR-1 Tax Returns & Compliance
- **Table 4 (B2B)**: Registered party sales with GSTINs.
- **Table 5 & 7 (B2C)**: Unregistered retail walk-in sales.
- **Table 12 (HSN Summary)**: HSN 6109 quantity, taxable values, and 5% tax breakdown.

### 8. Party Ledger & Statement of Accounts (खाता / लेजर)
- Interactive customer and vendor statement of account.
- Calculates Opening Balance B/F, Debits (+Dr for sales), Credits (-Cr for receipts & purchases), and Running Net Balance.
- Date range filtering with quick reset to full history or active Financial Year.
- 1-click **A4 Statement of Account** print format and instant CSV/Excel export.
- In-place **+ Record Payment** modal for recording cash, UPI, cheque, and bank settlements.

### 9. Accurate ERP (Old PC) Live Sync Bridge
- Standalone background sync agent in `SyncBill_Old_PC_Agent/`.
- **100% Read-Only & Non-Blocking**: Uses `WITH (NOLOCK)` on Microsoft SQL Server and watches backup folders so Accurate software never locks, freezes, or errors out while cashiers are using it.
- **Outbound Push**: Pushes new bills outward over HTTP/HTTPS, enabling remote sync even when working outside the shop without router port forwarding.
- Ready-to-use 1-click `.bat` scripts (`1_INSTALL_REQUIREMENTS.bat`, `2_TEST_CONNECTION.bat`, `3_START_BACKGROUND_SYNC.bat`).

---

## 🛠️ How to Run Locally

### Backend
```bash
cd backend
.\venv\Scripts\uvicorn app.main:app --port 8000
```

### Frontend
```bash
cd frontend
npm run dev -- --port 5173
```
