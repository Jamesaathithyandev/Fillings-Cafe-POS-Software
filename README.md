# 🍟 Sree Sai Fillings Cafe - Windows Desktop Billing & Database Software

A **Windows Desktop Billing, POS, Customer Database, Menu Management, and Excel Synchronization System** built exclusively for **Sree Sai Fillings Cafe** (Cheran Ma Nagar, Coimbatore).

---

## 🌟 Key Features

### 1. 100% Offline & Local
- Runs natively on your Windows PC with **zero internet connection required**.
- Uses an embedded **SQLite database** (`fillings_pos.db`) as the permanent primary source of truth.
- All customer histories, lifetime spends, and orders persist permanently across app restarts.

### 2. Centralized "Add Order" POS Workflow
- **Customer Search & Auto-Fill**: Instant lookup by phone number or name with autocomplete suggestions.
- **Fast Customer Creation**: Add new customer details (name, phone, address, notes) right inside the screen without navigating away.
- **Pre-seeded Menu**: Includes all 90 items and 12 categories from your official cafe menu cards (Fried Crispy Chicken, Burgers, Wraps, Pastas, Maggies, Bread Omelettes, Sandwiches, BBQ, Soft Drinks/Shakes, Fresh Juices, and Desserts).
- **Real-Time Cart**: Click items to add/increment quantities, adjust counts, apply flat or percentage discounts.
- **Payment Modes**: Instant one-click selection for **Cash**, **UPI**, **Card**, or **Other**.
- **Unique Bill Numbering**: Auto-generates `ORD-000001`, `ORD-000002`, etc.
- **Printable Thermal Receipt**: Formatted for standard 80mm/58mm POS thermal printers or standard paper.

### 3. Automatic 6-Sheet Excel Synchronization
- Automatically updates `Business_Data.xlsx` on every saved order.
- **Sheet 1: `CUSTOMERS`** (Customer ID, Name, Phone, Email, Address, Created Date, Total Orders, Total Spent, Last Order)
- **Sheet 2: `ORDERS`** (Order ID, Customer ID, Name, Phone, Date, Time, Subtotal, Discount, Final Total, Payment Method, Status)
- **Sheet 3: `ORDER_ITEMS`** (Order ID, Item ID, Item Name, Category, Quantity, Unit Price, Total Price)
- **Sheet 4: `MENU`** (Item ID, Name, Category, Price, Active Status, Date Added)
- **Sheet 5: `DAILY_SALES`** (Date, Number of Orders, Total Sales, Cash Sales, UPI Sales, Card Sales, Other Sales)
- **Sheet 6: `MONTHLY_SALES`** (Month, Number of Orders, Total Sales, Cash Sales, UPI Sales, Card Sales, Other Sales)
- **Safe Concurrency**: If the Excel file is open while billing, the order is safely saved in SQLite and the user is notified with a 1-click sync option when Excel is closed.

### 4. Customer Database & Lifetime Spending
- Dynamically calculates lifetime spending and total order counts from historical orders.
- Customer segmentation filters: *All Customers*, *High Spenders (₹2,000+)*, *Frequent (3+ Orders)*, and *Recently Active*.
- Customer profile drawer displaying complete chronological order history with itemized breakdown.

### 5. Menu Management
- Add new items, update prices, and edit descriptions without code modifications.
- **Historical Price Immutability**: Updating menu prices only affects future orders; historical bills strictly retain their original purchased price.
- **Enable/Disable Items**: Temporarily disable items from the POS without deleting historical data.

### 6. Sales Reports & Analytics
- **Daily Sales**: Date-by-date breakdown of orders, revenue, average order value, and payment channels.
- **Monthly Sales**: Monthly comparative analysis and revenue totals.
- **Custom Date Range Analysis**: Select any From Date and To Date to analyze revenue, unique customers, and top-selling items.

### 7. 1-Click Backups & Restore
- Creates timestamped database snapshot backups (`fillings_backup_YYYY-MM-DD_HH-mm-ss.db`) and companion Excel snapshots.
- Easy restore feature to recover data from any saved backup.

---

## 🚀 How to Run the Software

### 1. Launch the Desktop Application
In the project directory, run:
```bash
npm start
```

### 2. Run Automated Quality Assurance Tests
To verify all 12 operational scenarios and database calculations:
```bash
npm test
```

### 3. Build Windows Executable (.exe Installer)
To package the app into a standalone Windows installer:
```bash
npm run build
```

---

## ⌨️ Keyboard Shortcuts
- <kbd>F1</kbd> : Open **ADD ORDER / Billing** screen
- <kbd>F2</kbd> : Open **Customer Database** / Search Customer
- <kbd>F9</kbd> : **Save & Print Receipt**
- <kbd>F10</kbd> : **Save Order Only**

---

## 📂 Application File Structure
- **Database File**: `%APPDATA%/FillingsDatabaseSoftware/fillings_pos.db`
- **Excel Workbook**: `%APPDATA%/FillingsDatabaseSoftware/Business_Data.xlsx`
- **Backups Folder**: `%APPDATA%/FillingsDatabaseSoftware/backups/`
- **Exports Folder**: `%APPDATA%/FillingsDatabaseSoftware/exports/`

---
*Developed for Sree Sai Fillings Cafe — Live & Xclusive Eat Club • Coimbatore*
