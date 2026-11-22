// Sree Sai Fillings Cafe - Excel Sync & Reporting Engine
// Generates and synchronizes Business_Data.xlsx with 7 dedicated sheets
// Smart incremental sync: compares with local database and adds ONLY non-existing data (Zero Duplication)

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const dbManager = require('../database/db');
const queries = require('../database/queries');
const { isTestCustomerName } = queries;

let lastSyncTime = null;
let lastSyncStatus = { success: true, message: 'Ready' };

/**
 * Get default Business_Data.xlsx path in application data directory
 */
function getExcelFilePath() {
  const dir = dbManager.getDataDirectory();
  return path.join(dir, 'Business_Data.xlsx');
}

/**
 * Detect all user directories (Desktop, Documents, OneDrive) for Business_Data.xlsx
 */
function getOneDriveExcelPaths() {
  const userProfile = process.env.USERPROFILE || '';
  const oneDriveRoots = [
    process.env.OneDrive,
    process.env.OneDriveConsumer,
    process.env.OneDriveCommercial,
    userProfile ? path.join(userProfile, 'OneDrive') : null,
    userProfile ? path.join(userProfile, 'SkyDrive') : null,
    userProfile ? path.join(userProfile, 'Google Drive') : null,
    userProfile ? path.join(userProfile, 'Dropbox') : null,
    'C:\\OneDrive',
    'D:\\OneDrive'
  ].filter(Boolean);

  const foundPaths = new Set();

  // 1. Standard User Desktop & Documents (always targeted so cashier/admin can access directly)
  if (userProfile) {
    const localDesktop = path.join(userProfile, 'Desktop');
    const localDocs = path.join(userProfile, 'Documents');
    if (fs.existsSync(localDesktop)) {
      foundPaths.add(path.join(localDesktop, 'Business_Data.xlsx'));
    }
    if (fs.existsSync(localDocs)) {
      foundPaths.add(path.join(localDocs, 'Business_Data.xlsx'));
    }
  }

  // 2. OneDrive and Cloud drive locations (Desktop, Documents, Root, and subdirectories)
  for (const root of oneDriveRoots) {
    if (!fs.existsSync(root)) continue;

    const searchDirs = [
      path.join(root, 'Desktop'),
      path.join(root, 'Documents'),
      root
    ];

    const candidateNames = ['Business_Data.xlsx', 'Business_Data (1).xlsx'];

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;

      let foundAnyInDir = false;
      for (const name of candidateNames) {
        const fullCandidate = path.join(dir, name);
        if (fs.existsSync(fullCandidate)) {
          foundPaths.add(fullCandidate);
          foundAnyInDir = true;
        }
      }

      // If this is OneDrive/Desktop or OneDrive/Documents, ensure Business_Data.xlsx is mirrored
      if (!foundAnyInDir && (dir === path.join(root, 'Desktop') || dir === path.join(root, 'Documents'))) {
        foundPaths.add(path.join(dir, 'Business_Data.xlsx'));
      }
    }

    // Also scan 1 level deep inside root for any existing Business_Data.xlsx files (e.g. custom folders)
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory()) {
          const subDir = path.join(root, ent.name);
          for (const name of candidateNames) {
            const cand = path.join(subDir, name);
            if (fs.existsSync(cand)) {
              foundPaths.add(cand);
            }
          }
        }
      }
    } catch (e) {}
  }

  return Array.from(foundPaths);
}

/**
 * Mirror the updated Excel workbook to all target locations (Desktop, Documents, OneDrive)
 */
async function mirrorToOneDrive(sourceFilePath) {
  if (process.env.NODE_ENV === 'test') return [];
  if (!fs.existsSync(sourceFilePath)) return [];
  const targetPaths = getOneDriveExcelPaths();
  const results = [];

  for (const destPath of targetPaths) {
    if (path.resolve(sourceFilePath).toLowerCase() === path.resolve(destPath).toLowerCase()) {
      continue;
    }
    try {
      const targetDir = path.dirname(destPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      await fs.promises.copyFile(sourceFilePath, destPath);
      results.push({ path: destPath, success: true });
    } catch (err) {
      // If the destination file is open in Microsoft Excel (EBUSY/EPERM), copy to _Live.xlsx
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        const livePath = destPath.replace(/\.xlsx$/i, '_Live.xlsx');
        try {
          await fs.promises.copyFile(sourceFilePath, livePath);
          results.push({ path: livePath, success: true, liveFallback: true });
        } catch (liveErr) {
          results.push({ path: destPath, success: false, error: err.message });
        }
      } else {
        console.warn(`Excel mirror notice for ${destPath}:`, err.message);
        results.push({ path: destPath, success: false, error: err.message });
      }
    }
  }

  return results;
}

/**
 * Style constants for clean, professional workbook aesthetics
 */
const STYLES = {
  headerFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD97706' } // Warm Cafe Amber Gold
  },
  headerFont: {
    name: 'Segoe UI',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  },
  dataFont: {
    name: 'Segoe UI',
    size: 10
  },
  thinBorder: {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
  },
  zebraFill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFDFBF7' } // Light warm tint
  }
};

/**
 * Standard Column Configurations across all 7 sheets
 */
const SHEET_COLUMNS = {
  CUSTOMERS: [
    { header: 'Customer ID', key: 'customer_code', width: 16, align: 'center' },
    { header: 'Customer Name', key: 'name', width: 22, align: 'left' },
    { header: 'Phone', key: 'phone', width: 16, align: 'center' },
    { header: 'Email', key: 'email', width: 22, align: 'left' },
    { header: 'Address', key: 'address', width: 28, align: 'left' },
    { header: 'Date Created', key: 'created_at', width: 16, align: 'center' },
    { header: 'Total Orders', key: 'total_orders', width: 14, align: 'right', numFmt: '#,##0' },
    { header: 'Total Spent (₹)', key: 'total_spent', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Last Order Date', key: 'last_order_date', width: 16, align: 'center' }
  ],
  ORDERS: [
    { header: 'Order ID', key: 'order_number', width: 16, align: 'center' },
    { header: 'Customer ID', key: 'customer_code', width: 16, align: 'center' },
    { header: 'Customer Name', key: 'customer_name', width: 22, align: 'left' },
    { header: 'Phone', key: 'customer_phone', width: 16, align: 'center' },
    { header: 'Order Type', key: 'order_type', width: 14, align: 'center' },
    { header: 'Date', key: 'order_date', width: 14, align: 'center' },
    { header: 'Time', key: 'order_time', width: 12, align: 'center' },
    { header: 'Subtotal (₹)', key: 'subtotal', width: 14, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Packaging (₹)', key: 'packaging_charge', width: 14, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Discount (₹)', key: 'discount', width: 14, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Final Total (₹)', key: 'final_total', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Payment Method', key: 'payment_method', width: 16, align: 'center' },
    { header: 'Status', key: 'status', width: 14, align: 'center' }
  ],
  ORDER_ITEMS: [
    { header: 'Order ID', key: 'order_number', width: 16, align: 'center' },
    { header: 'Item ID', key: 'item_code', width: 14, align: 'center' },
    { header: 'Item Name', key: 'item_name', width: 26, align: 'left' },
    { header: 'Category', key: 'category_name', width: 20, align: 'left' },
    { header: 'Quantity', key: 'quantity', width: 12, align: 'right', numFmt: '#,##0' },
    { header: 'Unit Price (₹)', key: 'unit_price', width: 14, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Total (₹)', key: 'total_price', width: 16, align: 'right', numFmt: '₹#,##0.00' }
  ],
  MENU: [
    { header: 'Item ID', key: 'item_code', width: 14, align: 'center' },
    { header: 'Item Name', key: 'name', width: 28, align: 'left' },
    { header: 'Category', key: 'category_name', width: 22, align: 'left' },
    { header: 'Price (₹)', key: 'price', width: 14, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Active', key: 'is_active', width: 12, align: 'center' },
    { header: 'Date Added', key: 'created_at', width: 16, align: 'center' }
  ],
  DAILY_SALES: [
    { header: 'Date', key: 'date', width: 16, align: 'center' },
    { header: 'Number of Orders', key: 'number_of_orders', width: 18, align: 'right', numFmt: '#,##0' },
    { header: 'Total Sales (₹)', key: 'total_sales', width: 18, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Cash Sales (₹)', key: 'cash_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'UPI Sales (₹)', key: 'upi_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Card Sales (₹)', key: 'card_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Other Sales (₹)', key: 'other_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' }
  ],
  MONTHLY_SUMMARY: [
    { header: 'Month', key: 'month', width: 16, align: 'center' },
    { header: 'Number of Orders', key: 'number_of_orders', width: 18, align: 'right', numFmt: '#,##0' },
    { header: 'Total Sales (₹)', key: 'total_sales', width: 18, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Total Expenses (₹)', key: 'total_expenses', width: 18, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Net Profit (₹)', key: 'net_profit', width: 18, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Cash Sales (₹)', key: 'cash_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'UPI Sales (₹)', key: 'upi_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' }
  ],
  PURCHASES_EXPENSES: [
    { header: 'Date', key: 'expense_date', width: 15, align: 'center' },
    { header: 'Item Name', key: 'item_name', width: 26, align: 'left' },
    { header: 'Category', key: 'category', width: 18, align: 'left' },
    { header: 'Quantity', key: 'quantity', width: 15, align: 'center' },
    { header: 'Cost (₹)', key: 'cost', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Payment Mode', key: 'payment_mode', width: 16, align: 'center' },
    { header: 'Vendor / Shop', key: 'vendor', width: 22, align: 'left' },
    { header: 'Notes', key: 'notes', width: 30, align: 'left' }
  ]
};

/**
 * Format a worksheet with styled headers, alternating row colors, borders, and auto column widths
 */
function applySheetStyles(sheet, columnsConfig) {
  // Style Header Row
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = STYLES.headerFill;
    cell.font = STYLES.headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = STYLES.thinBorder;
  });

  // Style Data Rows
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 22;
    const isEven = rowNumber % 2 === 0;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = STYLES.dataFont;
      cell.border = STYLES.thinBorder;
      if (isEven) cell.fill = STYLES.zebraFill;

      const col = columnsConfig[colNumber - 1];
      if (col && col.align) {
        cell.alignment = { vertical: 'middle', horizontal: col.align };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      if (col && col.numFmt) {
        cell.numFmt = col.numFmt;
      }
    });
  });

  // Calculate Column Widths
  columnsConfig.forEach((colDef, idx) => {
    const colNumber = idx + 1;
    let maxLen = colDef.width || 14;
    sheet.getColumn(colNumber).eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value !== undefined && cell.value !== null ? cell.value.toString() : '';
      if (val.length > maxLen) maxLen = val.length;
    });
    sheet.getColumn(colNumber).width = Math.min(Math.max(maxLen + 3, 12), 40);
  });
}

/**
 * Build a fresh multi-sheet workbook from scratch
 */
async function generateWorkbook() {
  const data = queries.getFullExcelDataset();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sree Sai Fillings Cafe POS';
  workbook.lastModifiedBy = 'Sree Sai Fillings Cafe POS';
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. CUSTOMERS
  const customerSheet = workbook.addWorksheet('CUSTOMERS', { views: [{ state: 'frozen', ySplit: 1 }] });
  customerSheet.addRow(SHEET_COLUMNS.CUSTOMERS.map(c => c.header));
  data.customers
    .filter(c => !isTestCustomerName(c.name))
    .forEach((c) => {
    const createdDate = c.created_at ? c.created_at.split('T')[0] : '';
    customerSheet.addRow([
      c.customer_code || `CUST-${String(c.id).padStart(6, '0')}`,
      c.name,
      c.phone,
      c.email || '-',
      c.address || '-',
      createdDate,
      c.total_orders || 0,
      c.total_spent || 0,
      c.last_order_date || 'N/A'
    ]);
  });
  applySheetStyles(customerSheet, SHEET_COLUMNS.CUSTOMERS);

  // 2. ORDERS
  const orderSheet = workbook.addWorksheet('ORDERS', { views: [{ state: 'frozen', ySplit: 1 }] });
  orderSheet.addRow(SHEET_COLUMNS.ORDERS.map(c => c.header));
  data.orders
    .filter(o => !isTestCustomerName(o.customer_name) && o.order_number !== 'TEST-ORD')
    .forEach((o) => {
    orderSheet.addRow([
      o.order_number,
      `CUST-${String(o.customer_id).padStart(6, '0')}`,
      o.customer_name,
      o.customer_phone,
      o.order_type || 'Dine-In',
      o.order_date,
      o.order_time,
      o.subtotal,
      o.packaging_charge || 0,
      o.discount || 0,
      o.final_total,
      o.payment_method,
      o.status
    ]);
  });
  applySheetStyles(orderSheet, SHEET_COLUMNS.ORDERS);

  // 3. ORDER_ITEMS
  const orderItemsSheet = workbook.addWorksheet('ORDER_ITEMS', { views: [{ state: 'frozen', ySplit: 1 }] });
  orderItemsSheet.addRow(SHEET_COLUMNS.ORDER_ITEMS.map(c => c.header));
  data.orderItems
    .filter(oi => oi.order_number !== 'TEST-ORD')
    .forEach((oi) => {
    orderItemsSheet.addRow([
      oi.order_number,
      oi.item_code || `ITEM-${String(oi.menu_item_id || '000').padStart(3, '0')}`,
      oi.item_name,
      oi.category_name,
      oi.quantity,
      oi.unit_price,
      oi.total_price
    ]);
  });
  applySheetStyles(orderItemsSheet, SHEET_COLUMNS.ORDER_ITEMS);

  // 4. MENU
  const menuSheet = workbook.addWorksheet('MENU', { views: [{ state: 'frozen', ySplit: 1 }] });
  menuSheet.addRow(SHEET_COLUMNS.MENU.map(c => c.header));
  data.menu.forEach((m) => {
    menuSheet.addRow([
      m.item_code,
      m.name,
      m.category_name,
      m.price,
      m.is_active === 1 ? 'YES' : 'NO',
      m.created_at ? m.created_at.split('T')[0] : ''
    ]);
  });
  applySheetStyles(menuSheet, SHEET_COLUMNS.MENU);

  // 5. DAILY_SALES
  const dailySheet = workbook.addWorksheet('DAILY_SALES', { views: [{ state: 'frozen', ySplit: 1 }] });
  dailySheet.addRow(SHEET_COLUMNS.DAILY_SALES.map(c => c.header));
  data.dailySales.forEach((d) => {
    dailySheet.addRow([
      d.date,
      d.number_of_orders,
      d.total_sales,
      d.cash_sales,
      d.upi_sales,
      d.card_sales,
      d.other_sales
    ]);
  });
  applySheetStyles(dailySheet, SHEET_COLUMNS.DAILY_SALES);

  // 6. MONTHLY_SUMMARY
  const monthlySheet = workbook.addWorksheet('MONTHLY_SUMMARY', { views: [{ state: 'frozen', ySplit: 1 }] });
  monthlySheet.addRow(SHEET_COLUMNS.MONTHLY_SUMMARY.map(c => c.header));
  const monthExpMap = {};
  if (Array.isArray(data.expenses)) {
    data.expenses.forEach(e => {
      const m = (e.expense_date || '').substring(0, 7);
      monthExpMap[m] = (monthExpMap[m] || 0) + (parseFloat(e.cost) || 0);
    });
  }
  data.monthlySales.forEach((m) => {
    const exp = monthExpMap[m.month] || 0;
    const profit = (parseFloat(m.total_sales) || 0) - exp;
    monthlySheet.addRow([
      m.month,
      m.number_of_orders,
      m.total_sales,
      exp,
      profit,
      m.cash_sales,
      m.upi_sales
    ]);
  });
  applySheetStyles(monthlySheet, SHEET_COLUMNS.MONTHLY_SUMMARY);

  // 7. PURCHASES_EXPENSES
  const expenseSheet = workbook.addWorksheet('PURCHASES_EXPENSES', { views: [{ state: 'frozen', ySplit: 1 }] });
  expenseSheet.addRow(SHEET_COLUMNS.PURCHASES_EXPENSES.map(c => c.header));
  if (Array.isArray(data.expenses)) {
    data.expenses.forEach((e) => {
      expenseSheet.addRow([
        e.expense_date,
        e.item_name,
        e.category || 'General',
        e.quantity || '-',
        parseFloat(e.cost) || 0,
        e.payment_mode || 'Cash',
        e.vendor || '-',
        e.notes || ''
      ]);
    });
  }
  applySheetStyles(expenseSheet, SHEET_COLUMNS.PURCHASES_EXPENSES);

  return workbook;
}

let isSyncInProgress = false;
let pendingSyncPromise = null;
let queuedSyncResolve = null;

/**
 * Smart Automatic Incremental Synchronizer:
 * Compares current Business_Data.xlsx with local SQLite database.
 * Appends ONLY non-existing data and updates live metrics without duplicating rows.
 * Thread-safe: Queues subsequent calls if a sync is currently in progress.
 */
async function syncExcelWorkbook() {
  if (isSyncInProgress) {
    if (!pendingSyncPromise) {
      pendingSyncPromise = new Promise((resolve) => {
        queuedSyncResolve = resolve;
      }).then(async () => {
        pendingSyncPromise = null;
        queuedSyncResolve = null;
        return _doSyncExcelWorkbook();
      });
    }
    return pendingSyncPromise;
  }

  isSyncInProgress = true;
  try {
    const result = await _doSyncExcelWorkbook();
    return result;
  } finally {
    isSyncInProgress = false;
    if (queuedSyncResolve) {
      const trigger = queuedSyncResolve;
      queuedSyncResolve = null;
      trigger();
    }
  }
}

async function _doSyncExcelWorkbook() {
  const filePath = getExcelFilePath();

  // If file doesn't exist yet, generate initial workbook
  if (!fs.existsSync(filePath)) {
    try {
      const workbook = await generateWorkbook();
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await workbook.xlsx.writeFile(filePath);
          break;
        } catch (wErr) {
          if ((wErr.code === 'EBUSY' || wErr.code === 'EPERM') && attempt < 3) {
            await new Promise(r => setTimeout(r, 600));
            continue;
          }
          throw wErr;
        }
      }
      await mirrorToOneDrive(filePath);
      lastSyncTime = new Date().toISOString();
      lastSyncStatus = {
        success: true,
        locked: false,
        lastSync: lastSyncTime,
        filePath,
        message: 'Excel created and synchronized successfully.'
      };
      return lastSyncStatus;
    } catch (err) {
      console.warn('Initial Excel creation notice:', err.message);
    }
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const data = queries.getFullExcelDataset();

    // ----------------------------------------------------
    // 1. CUSTOMERS: Append non-existing phones, update stats for existing
    // ----------------------------------------------------
    let customerSheet = workbook.getWorksheet('CUSTOMERS');
    if (!customerSheet) {
      customerSheet = workbook.addWorksheet('CUSTOMERS', { views: [{ state: 'frozen', ySplit: 1 }] });
      customerSheet.addRow(SHEET_COLUMNS.CUSTOMERS.map(c => c.header));
    }

    const existingPhones = new Set();
    const phoneRowMap = new Map();
    customerSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const phone = String(row.getCell(3).value || '').trim();
      if (phone) {
        existingPhones.add(phone);
        phoneRowMap.set(phone, row);
      }
    });

    data.customers.forEach((c) => {
      const cleanPhone = (c.phone || '').trim();
      // Skip test customers
      if (isTestCustomerName(c.name)) return;
      if (!existingPhones.has(cleanPhone)) {
        const createdDate = c.created_at ? c.created_at.split('T')[0] : '';
        customerSheet.addRow([
          c.customer_code || `CUST-${String(c.id).padStart(6, '0')}`,
          c.name,
          c.phone,
          c.email || '-',
          c.address || '-',
          createdDate,
          c.total_orders || 0,
          c.total_spent || 0,
          c.last_order_date || 'N/A'
        ]);
        existingPhones.add(cleanPhone);
      } else {
        const row = phoneRowMap.get(cleanPhone);
        if (row) {
          row.getCell(7).value = c.total_orders || 0;
          row.getCell(8).value = c.total_spent || 0;
          row.getCell(9).value = c.last_order_date || 'N/A';
        }
      }
    });
    applySheetStyles(customerSheet, SHEET_COLUMNS.CUSTOMERS);

    // ----------------------------------------------------
    // 2. ORDERS: Append non-existing order numbers (Zero Duplicates)
    // ----------------------------------------------------
    let orderSheet = workbook.getWorksheet('ORDERS');
    if (!orderSheet) {
      orderSheet = workbook.addWorksheet('ORDERS', { views: [{ state: 'frozen', ySplit: 1 }] });
      orderSheet.addRow(SHEET_COLUMNS.ORDERS.map(c => c.header));
    }

    const existingOrders = new Set();
    orderSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const num = String(row.getCell(1).value || '').trim();
      if (num) existingOrders.add(num);
    });

    data.orders.forEach((o) => {
      const num = (o.order_number || '').trim();
      // Skip test orders
      if (isTestCustomerName(o.customer_name) || num === 'TEST-ORD') return;
      if (!existingOrders.has(num)) {
        orderSheet.addRow([
          o.order_number,
          `CUST-${String(o.customer_id).padStart(6, '0')}`,
          o.customer_name,
          o.customer_phone,
          o.order_type || 'Dine-In',
          o.order_date,
          o.order_time,
          o.subtotal,
          o.packaging_charge || 0,
          o.discount || 0,
          o.final_total,
          o.payment_method,
          o.status
        ]);
        existingOrders.add(num);
      }
    });
    applySheetStyles(orderSheet, SHEET_COLUMNS.ORDERS);

    // ----------------------------------------------------
    // 3. ORDER_ITEMS: Append non-existing items (Zero Duplicates)
    // ----------------------------------------------------
    let orderItemsSheet = workbook.getWorksheet('ORDER_ITEMS');
    if (!orderItemsSheet) {
      orderItemsSheet = workbook.addWorksheet('ORDER_ITEMS', { views: [{ state: 'frozen', ySplit: 1 }] });
      orderItemsSheet.addRow(SHEET_COLUMNS.ORDER_ITEMS.map(c => c.header));
    }

    const existingItems = new Set();
    orderItemsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const ordNum = String(row.getCell(1).value || '').trim();
      const itmName = String(row.getCell(3).value || '').trim();
      const qty = String(row.getCell(5).value || '').trim();
      if (ordNum && itmName) {
        existingItems.add(`${ordNum}_${itmName}_${qty}`);
      }
    });

    data.orderItems.forEach((oi) => {
      const key = `${(oi.order_number || '').trim()}_${(oi.item_name || '').trim()}_${oi.quantity}`;
      // Skip test order items
      if ((oi.order_number || '').trim() === 'TEST-ORD') return;
      if (!existingItems.has(key)) {
        orderItemsSheet.addRow([
          oi.order_number,
          oi.item_code || `ITEM-${String(oi.menu_item_id || '000').padStart(3, '0')}`,
          oi.item_name,
          oi.category_name,
          oi.quantity,
          oi.unit_price,
          oi.total_price
        ]);
        existingItems.add(key);
      }
    });
    applySheetStyles(orderItemsSheet, SHEET_COLUMNS.ORDER_ITEMS);

    // ----------------------------------------------------
    // 4. MENU: Add new items, update price & active status
    // ----------------------------------------------------
    let menuSheet = workbook.getWorksheet('MENU');
    if (!menuSheet) {
      menuSheet = workbook.addWorksheet('MENU', { views: [{ state: 'frozen', ySplit: 1 }] });
      menuSheet.addRow(SHEET_COLUMNS.MENU.map(c => c.header));
    }

    const existingMenuItems = new Set();
    const menuRowMap = new Map();
    menuSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const itemName = String(row.getCell(2).value || '').trim();
      if (itemName) {
        existingMenuItems.add(itemName);
        menuRowMap.set(itemName, row);
      }
    });

    data.menu.forEach((m) => {
      const cleanName = (m.name || '').trim();
      if (!existingMenuItems.has(cleanName)) {
        menuSheet.addRow([
          m.item_code,
          m.name,
          m.category_name,
          m.price,
          m.is_active === 1 ? 'YES' : 'NO',
          m.created_at ? m.created_at.split('T')[0] : ''
        ]);
        existingMenuItems.add(cleanName);
      } else {
        const row = menuRowMap.get(cleanName);
        if (row) {
          row.getCell(4).value = m.price;
          row.getCell(5).value = m.is_active === 1 ? 'YES' : 'NO';
        }
      }
    });
    applySheetStyles(menuSheet, SHEET_COLUMNS.MENU);

    // ----------------------------------------------------
    // 5. DAILY_SALES: Update or add dates (Zero duplicate dates)
    // ----------------------------------------------------
    let dailySheet = workbook.getWorksheet('DAILY_SALES');
    if (!dailySheet) {
      dailySheet = workbook.addWorksheet('DAILY_SALES', { views: [{ state: 'frozen', ySplit: 1 }] });
      dailySheet.addRow(SHEET_COLUMNS.DAILY_SALES.map(c => c.header));
    }

    const existingDates = new Set();
    const dateRowMap = new Map();
    dailySheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const dt = String(row.getCell(1).value || '').trim();
      if (dt) {
        existingDates.add(dt);
        dateRowMap.set(dt, row);
      }
    });

    data.dailySales.forEach((d) => {
      const cleanDate = (d.date || '').trim();
      if (!existingDates.has(cleanDate)) {
        dailySheet.addRow([
          d.date,
          d.number_of_orders,
          d.total_sales,
          d.cash_sales,
          d.upi_sales,
          d.card_sales,
          d.other_sales
        ]);
        existingDates.add(cleanDate);
      } else {
        const row = dateRowMap.get(cleanDate);
        if (row) {
          row.getCell(2).value = d.number_of_orders;
          row.getCell(3).value = d.total_sales;
          row.getCell(4).value = d.cash_sales;
          row.getCell(5).value = d.upi_sales;
          row.getCell(6).value = d.card_sales;
          row.getCell(7).value = d.other_sales;
        }
      }
    });
    applySheetStyles(dailySheet, SHEET_COLUMNS.DAILY_SALES);

    // ----------------------------------------------------
    // 6. MONTHLY_SUMMARY: Update or add months (Zero duplicate months)
    // ----------------------------------------------------
    let monthlySheet = workbook.getWorksheet('MONTHLY_SUMMARY');
    if (!monthlySheet) {
      monthlySheet = workbook.addWorksheet('MONTHLY_SUMMARY', { views: [{ state: 'frozen', ySplit: 1 }] });
      monthlySheet.addRow(SHEET_COLUMNS.MONTHLY_SUMMARY.map(c => c.header));
    }

    const monthExpMap = {};
    if (Array.isArray(data.expenses)) {
      data.expenses.forEach(e => {
        const m = (e.expense_date || '').substring(0, 7);
        monthExpMap[m] = (monthExpMap[m] || 0) + (parseFloat(e.cost) || 0);
      });
    }

    const existingMonths = new Set();
    const monthRowMap = new Map();
    monthlySheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const m = String(row.getCell(1).value || '').trim();
      if (m) {
        existingMonths.add(m);
        monthRowMap.set(m, row);
      }
    });

    data.monthlySales.forEach((m) => {
      const cleanMonth = (m.month || '').trim();
      const exp = monthExpMap[m.month] || 0;
      const profit = (parseFloat(m.total_sales) || 0) - exp;

      if (!existingMonths.has(cleanMonth)) {
        monthlySheet.addRow([
          m.month,
          m.number_of_orders,
          m.total_sales,
          exp,
          profit,
          m.cash_sales,
          m.upi_sales
        ]);
        existingMonths.add(cleanMonth);
      } else {
        const row = monthRowMap.get(cleanMonth);
        if (row) {
          row.getCell(2).value = m.number_of_orders;
          row.getCell(3).value = m.total_sales;
          row.getCell(4).value = exp;
          row.getCell(5).value = profit;
          row.getCell(6).value = m.cash_sales;
          row.getCell(7).value = m.upi_sales;
        }
      }
    });
    applySheetStyles(monthlySheet, SHEET_COLUMNS.MONTHLY_SUMMARY);

    // ----------------------------------------------------
    // 7. PURCHASES_EXPENSES: Append non-existing expenses (Zero Duplicates)
    // ----------------------------------------------------
    let expenseSheet = workbook.getWorksheet('PURCHASES_EXPENSES');
    if (!expenseSheet) {
      expenseSheet = workbook.addWorksheet('PURCHASES_EXPENSES', { views: [{ state: 'frozen', ySplit: 1 }] });
      expenseSheet.addRow(SHEET_COLUMNS.PURCHASES_EXPENSES.map(c => c.header));
    }

    const existingExpenses = new Set();
    expenseSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const dt = String(row.getCell(1).value || '').trim();
      const item = String(row.getCell(2).value || '').trim();
      const cost = String(row.getCell(5).value || '').trim();
      if (dt && item) {
        existingExpenses.add(`${dt}_${item}_${parseFloat(cost) || 0}`);
      }
    });

    if (Array.isArray(data.expenses)) {
      data.expenses.forEach((e) => {
        const key = `${(e.expense_date || '').trim()}_${(e.item_name || '').trim()}_${parseFloat(e.cost) || 0}`;
        if (!existingExpenses.has(key)) {
          expenseSheet.addRow([
            e.expense_date,
            e.item_name,
            e.category || 'General',
            e.quantity || '-',
            parseFloat(e.cost) || 0,
            e.payment_mode || 'Cash',
            e.vendor || '-',
            e.notes || ''
          ]);
          existingExpenses.add(key);
        }
      });
    }
    applySheetStyles(expenseSheet, SHEET_COLUMNS.PURCHASES_EXPENSES);

    // Write file safely to disk with retry
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await workbook.xlsx.writeFile(filePath);
        break;
      } catch (wErr) {
        if ((wErr.code === 'EBUSY' || wErr.code === 'EPERM') && attempt < 3) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        }
        throw wErr;
      }
    }
    await mirrorToOneDrive(filePath);

    lastSyncTime = new Date().toISOString();
    lastSyncStatus = {
      success: true,
      locked: false,
      lastSync: lastSyncTime,
      filePath,
      message: 'Excel auto-synchronized. All data up-to-date with zero duplicates.'
    };
    return lastSyncStatus;
  } catch (err) {
    const isLocked = err.code === 'EBUSY' || err.code === 'EPERM' || err.message.includes('busy') || err.message.includes('locked');
    console.warn('Excel Incremental Sync Notice:', err.message);
    
    lastSyncStatus = {
      success: false,
      locked: isLocked,
      lastSync: lastSyncTime,
      filePath,
      message: isLocked 
        ? 'Business_Data.xlsx is open in Excel. Will auto-sync when closed.'
        : `Excel sync notice: ${err.message}`
    };
    return lastSyncStatus;
  }
}

/**
 * Export full Excel workbook to a custom user-chosen location
 */
async function exportExcelToCustomPath(customFilePath) {
  const workbook = await generateWorkbook();
  await workbook.xlsx.writeFile(customFilePath);
  return {
    success: true,
    filePath: customFilePath,
    message: 'Exported successfully.'
  };
}

/**
 * Cleanly rebuild the entire Excel workbook from SQLite state
 * (Used when an order/expense is deleted to eliminate stale rows and recalculate metrics)
 * Thread-safe: Coordinates with the sync mutex.
 */
async function rebuildExcelWorkbook() {
  if (isSyncInProgress) {
    if (!pendingSyncPromise) {
      pendingSyncPromise = new Promise((resolve) => {
        queuedSyncResolve = resolve;
      }).then(async () => {
        pendingSyncPromise = null;
        queuedSyncResolve = null;
        return _doRebuildExcelWorkbook();
      });
    }
    return pendingSyncPromise;
  }

  isSyncInProgress = true;
  try {
    const result = await _doRebuildExcelWorkbook();
    return result;
  } finally {
    isSyncInProgress = false;
    if (queuedSyncResolve) {
      const trigger = queuedSyncResolve;
      queuedSyncResolve = null;
      trigger();
    }
  }
}

async function _doRebuildExcelWorkbook() {
  const filePath = getExcelFilePath();
  try {
    const workbook = await generateWorkbook();
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await workbook.xlsx.writeFile(filePath);
        break;
      } catch (wErr) {
        if ((wErr.code === 'EBUSY' || wErr.code === 'EPERM') && attempt < 3) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        }
        throw wErr;
      }
    }
    await mirrorToOneDrive(filePath);
    lastSyncTime = new Date().toISOString();
    lastSyncStatus = {
      success: true,
      locked: false,
      lastSync: lastSyncTime,
      filePath,
      message: 'Excel rebuilt and synchronized successfully.'
    };
    return lastSyncStatus;
  } catch (err) {
    const isLocked = err.code === 'EBUSY' || err.code === 'EPERM' || err.message.includes('busy') || err.message.includes('locked');
    console.warn('Excel Rebuild Notice:', err.message);
    lastSyncStatus = {
      success: false,
      locked: isLocked,
      lastSync: lastSyncTime,
      filePath,
      message: isLocked 
        ? 'Business_Data.xlsx is open in Excel. Will auto-sync when closed.'
        : `Excel sync notice: ${err.message}`
    };
    return lastSyncStatus;
  }
}

function getSyncStatus() {
  const oneDrivePaths = getOneDriveExcelPaths();
  return {
    ...lastSyncStatus,
    filePath: getExcelFilePath(),
    oneDrivePaths,
    lastSyncTime
  };
}

module.exports = {
  getExcelFilePath,
  getOneDriveExcelPaths,
  mirrorToOneDrive,
  syncExcelWorkbook,
  rebuildExcelWorkbook,
  exportExcelToCustomPath,
  getSyncStatus
};
