# 🖥️ SyncBill ERP — Old PC Silent Sync Setup Guide
### (100% Accurate Crystal Reports Bridge + 24/7 Silent Background Sync)

This package is for your **Old Shop PC** where Accurate ERP and SQL Server (`AtechDB`) are installed.

---

## 📦 What is Inside This Folder

| File | What It Does |
| :--- | :--- |
| **`1_INITIAL_SETUP_AND_GOOGLE_LOGIN.bat`** | Double-click this first. Automatically installs required Python packages and logs in to Google Drive once in your browser. |
| **`INSTALL_SILENT_SERVICE.bat`** | **Run as Administrator**. Registers a Windows background task that runs invisibly forever (zero black command windows, auto-starts on PC boot). |
| **`UNINSTALL_SERVICE.bat`** | **Run as Administrator** if you ever want to stop or remove the background service. |
| **`2_TEST_CONNECTION.bat`** | Tests your SQL Server (`AtechDB`) and network connection in 5 seconds to confirm everything is working. |
| **`3_START_BACKGROUND_SYNC.bat`** | Runs the sync agent in a normal console window so you can watch live synchronization messages. |
| **`silent_background_agent.py`** | The resilient 24/7 background worker (waits for Wi-Fi on boot, zero locking on Accurate, never freezes software). |
| **`export_accurate_rpt.py`** | Exports 100% authentic Accurate `.rpt` format PDFs for every party ledger and invoice. |
| **`config.json`** | Configuration file (SQL Server instance, database name, sync interval). |
| **`INSTRUCTIONS.txt`** | Quick notepad guide for running on the shop PC. |

---

## 🌟 3 Step-by-Step Installation on the Shop PC

### Step 1: Copy to Old PC
1. Extract or copy this entire `SyncBill_Old_PC_Agent` folder onto a USB pen drive.
2. Paste the folder anywhere on the **Old PC** (e.g. `C:\SyncBill_Old_PC_Agent` or on the Desktop).
3. Ensure Python (version 3.8 to 3.12 or newer) is installed on the Old PC with **"Add python.exe to PATH"** checked.

---

### Step 2: One-Time Setup & Google Login
1. If using Google Drive cloud sync:
   - Place your `credentials.json` (Google Cloud OAuth Client ID) inside this folder.
   - If you do not have `credentials.json` yet, the agent will still safely run locally and export all reports!
2. Double-click:
   ```text
   1_INITIAL_SETUP_AND_GOOGLE_LOGIN.bat
   ```
3. A command prompt will automatically install all required packages (`google-api-python-client`, `pyodbc`, `requests`, etc.) and open your browser for a one-time Google sign-in.
4. Once signed in, it saves `token.json` permanently. You never have to sign in again.

---

### Step 3: Install the Silent Background Service (Zero Black Windows)
1. Right-click:
   ```text
   INSTALL_SILENT_SERVICE.bat
   ```
2. Select **"Run as administrator"**.
3. You will see:
   ```text
   [SUCCESS] SyncBill Silent Background Task created successfully!
   Task Name: SyncBillAccurateCloudSync
   State: Running silently via pythonw.exe (Zero Black Windows)
   ```
4. **Done!** The background task is now active. 
   - It will run silently in the background 24/7.
   - When the shop PC is restarted in the morning, it starts automatically.
   - It will never show any black terminal windows or interfere with staff using Accurate.

---

## 🛡️ Reliability & Safety Guarantees

* **100% Non-Blocking (NOLOCK):** Every query executed against Accurate uses `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED` and `WITH (NOLOCK)`. It never locks tables, never slows down Accurate, and never causes crashes.
* **Wi-Fi Resilient:** If the shop Wi-Fi drops or the PC boots before the router connects, the agent silently waits and auto-reconnects when the connection is back.
* **Activity Log:** You can check `sync_activity.log` anytime in Notepad to inspect background sync activity and timestamps.
