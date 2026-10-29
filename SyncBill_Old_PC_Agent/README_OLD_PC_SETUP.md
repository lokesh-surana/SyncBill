# 🖥️ SyncBill ERP — Old PC Silent Cloud Agent Setup Guide
### (100% Authentic Accurate .rpt Crystal Reports + 24/7 Google Drive Relay)

This package runs on your **Old PC in the shop** where Accurate ERP and SQL Server are installed.

---

## 🌟 How It Works (Zero-Overlap Asynchronous Cloud Sync)

* **Shop Hours (Old PC is ON, Laptop is OFF):**
  - Accurate creates new bills, receipts, or payments.
  - The silent background agent exports **100% authentic Accurate `.rpt` PDFs** for every bill and ledger.
  - Automatically uploads all PDFs and the change manifest (`sync_changes.json`) to your **Google Drive**.
* **Night Time (Old PC is OFF, Laptop is ON):**
  - When you launch SyncBill on your laptop after hours, it pulls the change manifest from Google Drive.
  - All party balances, new purchase/sale bills, and official PDF links are instantly updated on your laptop.
* **On Your Phone:**
  - You open Google Drive on your mobile phone and can share any party's official Accurate statement or bill directly to WhatsApp 24/7.

---

## 🛡️ Reliability Guarantees

* **Zero Black Windows:** Uses `pythonw.exe` and Windows Task Scheduler. No command prompt windows will ever appear on screen or be accidentally closed by staff.
* **Starts with Windows:** Auto-starts on PC boot/login silently.
* **Wi-Fi Resilient:** Waits silently for Wi-Fi and SQL Server to wake up on boot before syncing. Never crashes.
* **100% Read-Only:** Uses `READ UNCOMMITTED (NOLOCK)`. Never modifies, locks, or slows down Accurate.

---

## 🚀 3-Step Setup on the Old PC

### Step 1: Copy this Folder to Old PC
1. Copy the entire `SyncBill_Old_PC_Agent` folder onto a USB pen drive.
2. Paste it on the **Old PC** (for example, on `C:\SyncBill_Agent` or Desktop).

---

### Step 2: One-Time Google Drive Login
1. Ensure your `credentials.json` (OAuth Client ID from Google Cloud Console) is placed inside this folder.
2. Double-click:
   `1_INITIAL_SETUP_AND_GOOGLE_LOGIN.bat`
3. A browser window will open asking you to sign into your Google account once.
4. It will verify SQL Server connection, test Google Drive folder creation, and create `token.json`.

---

### Step 3: Install the Silent Background Service
1. Right-click:
   **`INSTALL_SILENT_SERVICE.bat`**
2. Select **"Run as administrator"**.
3. That is all! 
   - Windows registers the background task.
   - It will run invisibly in the background forever without any black windows.

---

## 📋 Verifying Activity & Uninstallation

* **Check Activity:** Open `sync_activity.log` in Notepad to see silent timestamps and sync status.
* **Uninstall:** If you ever need to stop or remove the background service, right-click `UNINSTALL_SERVICE.bat` and select **"Run as administrator"**.
