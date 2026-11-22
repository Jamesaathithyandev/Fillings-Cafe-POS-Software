# 📊 Sree Sai Fillings Cafe — Live Google Sheets Setup Guide

Because Microsoft discontinued OneDrive desktop synchronization support on **Windows 7**, Google Sheets is the **ideal, 100% reliable cloud solution**. It allows someone in another city (or on a smartphone/tablet) to monitor orders, customers, and financial reports **in real-time as each order is punched**.

---

## ⚡ Quick 2-Minute Setup

### Step 1: Create a Google Spreadsheet
1. Open your browser and go to [https://sheets.new](https://sheets.new).
2. Name your spreadsheet at the top left:
   `Sree Sai Fillings Cafe - Live Business Data`

---

### Step 2: Open Google Apps Script
1. In the Google Sheets menu, click **Extensions** > **Apps Script**.
2. A new code editor tab will open.
3. Delete any default code inside `Code.gs`.

---

### Step 3: Paste the Fillings Sync Script
1. Open the file [`google_sheets_sync/FillingsCafe_GoogleSheets_Sync.js`](file:///c:/Users/Hp/OneDrive/Desktop/Fillings%20Database%20Software/google_sheets_sync/FillingsCafe_GoogleSheets_Sync.js) from this folder.
2. Copy the entire file contents and paste it into the Apps Script editor.
3. Press **Ctrl + S** (or click the Save 💾 icon).

---

### Step 4: Run Initial Setup (Creates All 7 Sheets)
1. At the top of the Apps Script toolbar, locate the function dropdown (it might say `myFunction` or `doPost`).
2. Select **`setupAllSheets`**.
3. Click the **Run** button (▶️).
4. Google will ask for permission once:
   - Click **Review permissions**
   - Choose your Google account
   - Click **Advanced** (small text)
   - Click **Go to Untitled project (unsafe)**
   - Click **Allow**
5. Return to your Google Spreadsheet tab — you will see all 7 sheets created and styled with Amber headers and custom columns:
   - `ORDERS`
   - `CUSTOMERS`
   - `ORDER_ITEMS`
   - `MENU`
   - `DAILY_SALES`
   - `MONTHLY_SUMMARY`
   - `PURCHASES_EXPENSES`

---

### Step 5: Deploy as Web App
1. In the top right corner of the Apps Script editor, click **Deploy** > **New deployment**.
2. In the modal that opens, click the gear icon (⚙️) next to "Select type" and choose **Web app**.
3. Configure the fields:
   - **Description**: `Fillings POS Live Sync`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: **`Anyone`** *(⚠️ Critical: must be Anyone so POS can send orders without Google login prompts)*
4. Click **Deploy**.
5. Copy the **Web app URL** (starts with `https://script.google.com/macros/s/.../exec`).

---

### Step 6: Connect POS Software
1. In your **Sree Sai Fillings POS** software, go to **Excel & Backup** (or click the **Live Sheet** button in the top bar).
2. Under the **Google Sheets Live Real-Time Document** card:
   - Paste the **Web app URL**.
   - Paste your **Google Spreadsheet link** (the URL in your browser bar for your spreadsheet).
3. Click **Save & Test Connection**.
4. Click **Sync All 7 Sheets Now** to immediately upload all existing historical orders, customers, and menu items to Google Sheets!

---

## 🎯 How It Works After Setup
- Every time an order is saved, settled, or updated at the counter, the POS automatically sends it to your Google Sheet in less than 1 second.
- Anyone in another city opening the Google Sheet will see orders appear live without needing to reload or open Excel.
- Works offline-first: if the internet drops momentarily, orders are stored locally in SQLite, and sync to Google Sheets as soon as internet is back.
