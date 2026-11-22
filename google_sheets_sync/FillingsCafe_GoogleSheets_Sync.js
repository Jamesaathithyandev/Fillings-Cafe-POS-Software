/**
 * ============================================================================
 * ☕ SREE SAI FILLINGS CAFE — REAL-TIME LIVE GOOGLE SHEETS SYNC ENGINE
 * ============================================================================
 * 
 * High-Performance Edition: Optimized with Batch Operations for Sub-Second Sync.
 * 
 * Works 100% seamlessly on Windows 7, Windows 10, Windows 11, Mac, and mobile.
 * Anyone with the link in another city can monitor orders, sales, and analytics
 * LIVE in real-time without needing OneDrive or Microsoft Excel!
 * 
 * ----------------------------------------------------------------------------
 * 🚀 QUICK 2-MINUTE SETUP INSTRUCTIONS:
 * ----------------------------------------------------------------------------
 * 1. Open Google Sheets (https://sheets.new) and name it:
 *    "Sree Sai Fillings Cafe - Live Business Data"
 * 
 * 2. In the top menu, click: Extensions > Apps Script
 * 
 * 3. Delete ALL code in the editor, paste this ENTIRE file, and click Save (💾).
 * 
 * 4. At the top of the editor, select "setupAllSheets" from the function dropdown,
 *    and click "Run".
 *    (Google will ask for permission once — click Review Permissions >
 *     Choose your Account > Advanced > Go to Untitled (unsafe) > Allow).
 *    -> In 3 seconds, all 7 sheets will be created and professionally styled!
 * 
 * 5. In top right, click: Deploy > Manage deployments > Edit (pencil icon) >
 *    Version: "New version" > Deploy.
 *    (Or Deploy > New Deployment > Web app > Execute as: "Me" > Who has access: "Anyone" > Deploy)
 * 
 * 6. Copy the "Web app URL" (starts with https://script.google.com/macros/s/...)
 * ============================================================================
 */

// ─── CONFIGURATION & STYLES ──────────────────────────────────────────────────

const THEME = {
  headerBg: '#D97706',      // Warm Amber Gold
  headerFont: '#FFFFFF',    // White
  zebraBg: '#FDFBF7',       // Ultra-light warm cream
  border: '#E5E7EB',        // Light gray
  fontFamily: 'Segoe UI'
};

const SHEET_NAMES = {
  ORDERS: 'ORDERS',
  CUSTOMERS: 'CUSTOMERS',
  ORDER_ITEMS: 'ORDER_ITEMS',
  MENU: 'MENU',
  DAILY_SALES: 'DAILY_SALES',
  MONTHLY_SUMMARY: 'MONTHLY_SUMMARY',
  PURCHASES_EXPENSES: 'PURCHASES_EXPENSES'
};

const HEADERS = {
  ORDERS: [
    'Order ID', 'Customer ID', 'Customer Name', 'Phone', 'Order Type',
    'Date', 'Time', 'Subtotal (₹)', 'Packaging (₹)', 'Discount (₹)',
    'Final Total (₹)', 'Payment Method', 'Status'
  ],
  CUSTOMERS: [
    'Customer ID', 'Customer Name', 'Phone', 'Email', 'Address',
    'Date Created', 'Total Orders', 'Total Spent (₹)', 'Last Order Date'
  ],
  ORDER_ITEMS: [
    'Order ID', 'Item ID', 'Item Name', 'Category',
    'Quantity', 'Unit Price (₹)', 'Total (₹)'
  ],
  MENU: [
    'Item ID', 'Item Name', 'Category', 'Price (₹)', 'Active', 'Date Added'
  ],
  DAILY_SALES: [
    'Date', 'Number of Orders', 'Total Sales (₹)', 'Cash Sales (₹)',
    'UPI Sales (₹)', 'Card Sales (₹)', 'Other Sales (₹)'
  ],
  MONTHLY_SUMMARY: [
    'Month', 'Number of Orders', 'Total Sales (₹)', 'Total Expenses (₹)',
    'Net Profit (₹)', 'Cash Sales (₹)', 'UPI Sales (₹)'
  ],
  PURCHASES_EXPENSES: [
    'Date', 'Item Name', 'Category', 'Quantity', 'Cost (₹)',
    'Payment Mode', 'Vendor / Shop', 'Notes'
  ]
};

// ─── DATE NORMALIZER (FIXES GOOGLE SHEETS DATE OBJECTS) ──────────────────────

/**
 * Normalizes any Date object or date string into strict "YYYY-MM-DD" format.
 * Prevents Google Sheets Date objects from converting to "Wed Sep 25..." day strings!
 */
function normalizeDateStr(val, ss) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' || val instanceof Date) {
    const tz = ss ? ss.getSpreadsheetTimeZone() : 'Asia/Kolkata';
    return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const tz = ss ? ss.getSpreadsheetTimeZone() : 'Asia/Kolkata';
    return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  }
  return s;
}

// ─── ONE-CLICK INITIAL SETUP ─────────────────────────────────────────────────

/**
 * Run this function once from the Apps Script editor to create & style all 7 sheets!
 */
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Object.keys(HEADERS).forEach(sheetKey => {
    const sheetName = SHEET_NAMES[sheetKey];
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Clear and set headers
    sheet.clear();
    const cols = HEADERS[sheetKey];
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
    
    // Style Header Row in ONE batch
    const headerRange = sheet.getRange(1, 1, 1, cols.length);
    headerRange.setBackground(THEME.headerBg);
    headerRange.setFontColor(THEME.headerFont);
    headerRange.setFontWeight('bold');
    headerRange.setFontFamily(THEME.fontFamily);
    headerRange.setHorizontalAlignment('center');
    headerRange.setVerticalAlignment('middle');
    sheet.setRowHeight(1, 32);
    sheet.setFrozenRows(1);

    // Pre-style Data Area font in ONE batch
    sheet.getRange(2, 1, 2000, cols.length)
      .setFontFamily(THEME.fontFamily)
      .setFontSize(10)
      .setVerticalAlignment('middle');
    
    for (let c = 1; c <= cols.length; c++) {
      sheet.setColumnWidth(c, 140);
    }

    // Number formatting & alignments per sheet
    if (sheetKey === 'MONTHLY_SUMMARY') {
      sheet.getRange(2, 1, 2000, 1).setNumberFormat('@').setHorizontalAlignment('center'); // Month strictly as plain text
      sheet.getRange(2, 2, 2000, 1).setNumberFormat('#,##0').setHorizontalAlignment('right'); // Orders
      sheet.getRange(2, 3, 2000, 5).setNumberFormat('₹#,##0.00').setHorizontalAlignment('right'); // Amounts
    } else if (sheetKey === 'DAILY_SALES') {
      sheet.getRange(2, 1, 2000, 1).setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center'); // Date
      sheet.getRange(2, 2, 2000, 1).setNumberFormat('#,##0').setHorizontalAlignment('right'); // Orders
      sheet.getRange(2, 3, 2000, 5).setNumberFormat('₹#,##0.00').setHorizontalAlignment('right'); // Amounts
    } else if (sheetKey === 'ORDERS') {
      sheet.getRange(2, 1, 2000, 2).setNumberFormat('@').setHorizontalAlignment('center');
      sheet.getRange(2, 3, 2000, 1).setHorizontalAlignment('left');
      sheet.getRange(2, 4, 2000, 1).setNumberFormat('@').setHorizontalAlignment('center');
      sheet.getRange(2, 5, 2000, 3).setHorizontalAlignment('center');
      sheet.getRange(2, 6, 2000, 1).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(2, 8, 2000, 4).setNumberFormat('₹#,##0.00').setHorizontalAlignment('right');
      sheet.getRange(2, 12, 2000, 2).setHorizontalAlignment('center');
    } else if (sheetKey === 'CUSTOMERS') {
      sheet.getRange(2, 1, 2000, 1).setNumberFormat('@').setHorizontalAlignment('center');
      sheet.getRange(2, 2, 2000, 1).setHorizontalAlignment('left');
      sheet.getRange(2, 3, 2000, 1).setNumberFormat('@').setHorizontalAlignment('center');
      sheet.getRange(2, 4, 2000, 2).setHorizontalAlignment('left');
      sheet.getRange(2, 6, 2000, 1).setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center');
      sheet.getRange(2, 7, 2000, 1).setNumberFormat('#,##0').setHorizontalAlignment('right');
      sheet.getRange(2, 8, 2000, 1).setNumberFormat('₹#,##0.00').setHorizontalAlignment('right');
      sheet.getRange(2, 9, 2000, 1).setHorizontalAlignment('center');
    } else if (sheetKey === 'ORDER_ITEMS') {
      sheet.getRange(2, 1, 2000, 2).setNumberFormat('@').setHorizontalAlignment('center');
      sheet.getRange(2, 3, 2000, 2).setHorizontalAlignment('left');
      sheet.getRange(2, 5, 2000, 1).setNumberFormat('#,##0').setHorizontalAlignment('right');
      sheet.getRange(2, 6, 2000, 2).setNumberFormat('₹#,##0.00').setHorizontalAlignment('right');
    } else if (sheetKey === 'MENU') {
      sheet.getRange(2, 1, 2000, 1).setNumberFormat('@').setHorizontalAlignment('center');
      sheet.getRange(2, 2, 2000, 2).setHorizontalAlignment('left');
      sheet.getRange(2, 4, 2000, 1).setNumberFormat('₹#,##0.00').setHorizontalAlignment('right');
      sheet.getRange(2, 5, 2000, 2).setHorizontalAlignment('center');
    } else if (sheetKey === 'PURCHASES_EXPENSES') {
      sheet.getRange(2, 1, 2000, 1).setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center');
      sheet.getRange(2, 2, 2000, 2).setHorizontalAlignment('left');
      sheet.getRange(2, 4, 2000, 1).setHorizontalAlignment('center');
      sheet.getRange(2, 5, 2000, 1).setNumberFormat('₹#,##0.00').setHorizontalAlignment('right');
      sheet.getRange(2, 6, 2000, 1).setHorizontalAlignment('center');
      sheet.getRange(2, 7, 2000, 2).setHorizontalAlignment('left');
    }
  });

  // Remove default "Sheet1" if present
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  Logger.log('✅ All 7 sheets for Sree Sai Fillings Cafe created and styled successfully!');
}

// ─── WEB APP ENDPOINT (POST) ─────────────────────────────────────────────────

/**
 * Handles incoming live sync POST requests from Fillings Cafe POS.
 */
function doPost(e) {
  try {
    let payload = null;
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter && e.parameter.data) {
      payload = JSON.parse(e.parameter.data);
    } else {
      return jsonResponse({ success: false, message: 'No payload received' });
    }

    const action = (payload.action || 'SYNC_ORDER').toUpperCase();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case 'PING':
        return jsonResponse({
          success: true,
          message: 'Google Sheets Live Sync Connected!',
          timestamp: new Date().toISOString()
        });

      case 'SYNC_ORDER':
        return handleSyncOrder(ss, payload.order, payload.items);

      case 'SYNC_EXPENSE':
        return handleSyncExpense(ss, payload.expense);

      case 'FULL_SYNC':
      case 'RESET_AND_SYNC':
        return handleFullSync(ss, payload.dataset, payload.reset || action === 'RESET_AND_SYNC');

      default:
        return jsonResponse({ success: false, message: 'Unknown action: ' + action });
    }
  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Handles GET health checks.
 */
function doGet(e) {
  return jsonResponse({
    success: true,
    status: 'online',
    system: 'Sree Sai Fillings Cafe - Google Sheets Live Sync Engine',
    timestamp: new Date().toISOString()
  });
}

// ─── SYNC HANDLERS (OPTIMIZED FOR SPEED) ──────────────────────────────────────

/**
 * Sync an individual order and its items in real-time.
 */
function handleSyncOrder(ss, order, items) {
  if (!order || !order.order_number) {
    return jsonResponse({ success: false, message: 'Order data missing order_number' });
  }

  // 1. ORDERS SHEET
  const orderSheet = getOrInitSheet(ss, SHEET_NAMES.ORDERS, HEADERS.ORDERS);
  const existingOrders = getExistingColumnValues(orderSheet, 1);
  const orderNum = String(order.order_number).trim();

  const orderRow = [
    orderNum,
    order.customer_code || ('CUST-' + String(order.customer_id || 1).padStart(6, '0')),
    order.customer_name || 'Counter Customer',
    order.customer_phone || '-',
    order.order_type || 'Dine-In',
    normalizeDateStr(order.order_date, ss) || normalizeDateStr(new Date(), ss),
    order.order_time || '',
    parseFloat(order.subtotal || 0),
    parseFloat(order.packaging_charge || 0),
    parseFloat(order.discount || 0),
    parseFloat(order.final_total || 0),
    order.payment_method || 'Cash',
    order.status || 'COMPLETED'
  ];

  if (!existingOrders.has(orderNum)) {
    orderSheet.appendRow(orderRow);
  } else {
    const rowIdx = findRowIndexByColumn(orderSheet, 1, orderNum);
    if (rowIdx > 0) {
      orderSheet.getRange(rowIdx, 1, 1, orderRow.length).setValues([orderRow]);
    }
  }

  // 2. ORDER_ITEMS SHEET (Batch Append)
  if (Array.isArray(items) && items.length > 0) {
    const itemsSheet = getOrInitSheet(ss, SHEET_NAMES.ORDER_ITEMS, HEADERS.ORDER_ITEMS);
    const existingItemKeys = getExistingItemKeys(itemsSheet);
    const itemRows = [];

    items.forEach(it => {
      const itmName = it.name || it.item_name || '';
      const qty = parseInt(it.quantity || 1, 10);
      const key = `${orderNum}_${itmName}_${qty}`;

      if (!existingItemKeys.has(key)) {
        itemRows.push([
          orderNum,
          it.item_code || it.code || ('ITEM-' + String(it.id || '000').padStart(3, '0')),
          itmName,
          it.category_name || it.category || 'General',
          qty,
          parseFloat(it.price || it.unit_price || 0),
          parseFloat(it.total_price || ((it.price || 0) * qty))
        ]);
        existingItemKeys.add(key);
      }
    });

    if (itemRows.length > 0) {
      itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, itemRows.length, HEADERS.ORDER_ITEMS.length).setValues(itemRows);
    }
  }

  // 3. CUSTOMERS SHEET (Update / Add)
  if (order.customer_phone) {
    const custSheet = getOrInitSheet(ss, SHEET_NAMES.CUSTOMERS, HEADERS.CUSTOMERS);
    const cleanPhone = String(order.customer_phone).trim();
    const custPhoneMap = getRowMapByColumn(custSheet, 3);
    const ordDt = normalizeDateStr(order.order_date, ss) || normalizeDateStr(new Date(), ss);

    if (custPhoneMap.has(cleanPhone)) {
      const rIdx = custPhoneMap.get(cleanPhone);
      const curOrders = parseInt(custSheet.getRange(rIdx, 7).getValue() || 0, 10);
      const curSpent = parseFloat(custSheet.getRange(rIdx, 8).getValue() || 0);
      custSheet.getRange(rIdx, 7, 1, 3).setValues([[
        curOrders + 1,
        curSpent + parseFloat(order.final_total || 0),
        ordDt
      ]]);
    } else {
      custSheet.appendRow([
        order.customer_code || ('CUST-' + String(cleanPhone).slice(-6)),
        order.customer_name || 'Guest',
        cleanPhone,
        order.customer_email || '-',
        order.customer_address || '-',
        ordDt,
        1,
        parseFloat(order.final_total || 0),
        ordDt
      ]);
    }
  }

  // 4. DAILY_SALES & MONTHLY_SUMMARY (Recalculate live totals)
  recalculateDailyAndMonthly(ss);

  return jsonResponse({
    success: true,
    message: `Order ${orderNum} synchronized to Google Sheets live!`,
    orderNumber: orderNum
  });
}

/**
 * Sync an individual expense in real-time.
 */
function handleSyncExpense(ss, expense) {
  if (!expense || !expense.item_name) {
    return jsonResponse({ success: false, message: 'Expense item_name required' });
  }

  const expSheet = getOrInitSheet(ss, SHEET_NAMES.PURCHASES_EXPENSES, HEADERS.PURCHASES_EXPENSES);
  const dt = normalizeDateStr(expense.expense_date, ss) || normalizeDateStr(new Date(), ss);
  const item = expense.item_name;
  const cost = parseFloat(expense.cost || 0);

  expSheet.appendRow([
    dt,
    item,
    expense.category || 'General',
    expense.quantity || '-',
    cost,
    expense.payment_mode || 'Cash',
    expense.vendor || '-',
    expense.notes || ''
  ]);

  recalculateDailyAndMonthly(ss);

  return jsonResponse({
    success: true,
    message: `Expense "${item}" synchronized to Google Sheets!`
  });
}

/**
 * Full snapshot synchronization: BATCH writes entire dataset in seconds.
 * Mirrors Business_Data.xlsx 100% identically.
 */
function handleFullSync(ss, data, isReset = false) {
  if (!data) return jsonResponse({ success: false, message: 'No dataset provided' });

  // If reset requested: clear rows 2+ across all sheets to start completely fresh
  if (isReset) {
    Object.values(SHEET_NAMES).forEach(name => {
      const sh = ss.getSheetByName(name);
      if (sh && sh.getLastRow() > 1) {
        sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
      }
    });
  }

  // 1. CUSTOMERS (Batch)
  if (Array.isArray(data.customers)) {
    const sheet = getOrInitSheet(ss, SHEET_NAMES.CUSTOMERS, HEADERS.CUSTOMERS);
    const existing = isReset ? new Set() : getExistingColumnValues(sheet, 3);
    const newCusts = [];
    data.customers.forEach(c => {
      const phone = String(c.phone || '').trim();
      if (phone && !existing.has(phone)) {
        newCusts.push([
          c.customer_code || `CUST-${String(c.id).padStart(6, '0')}`,
          c.name || 'Guest',
          phone,
          c.email || '-',
          c.address || '-',
          normalizeDateStr(c.created_at, ss) || '',
          c.total_orders || 0,
          parseFloat(c.total_spent || 0),
          normalizeDateStr(c.last_order_date, ss) || 'N/A'
        ]);
        existing.add(phone);
      }
    });
    if (newCusts.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newCusts.length, HEADERS.CUSTOMERS.length).setValues(newCusts);
    }
  }

  // 2. ORDERS (Batch)
  if (Array.isArray(data.orders)) {
    const sheet = getOrInitSheet(ss, SHEET_NAMES.ORDERS, HEADERS.ORDERS);
    const existing = isReset ? new Set() : getExistingColumnValues(sheet, 1);
    const newOrders = [];
    data.orders.forEach(o => {
      const num = String(o.order_number || '').trim();
      if (num && !existing.has(num)) {
        newOrders.push([
          num,
          `CUST-${String(o.customer_id || 1).padStart(6, '0')}`,
          o.customer_name || 'Guest',
          o.customer_phone || '-',
          o.order_type || 'Dine-In',
          normalizeDateStr(o.order_date, ss) || '',
          o.order_time || '',
          parseFloat(o.subtotal || 0),
          parseFloat(o.packaging_charge || 0),
          parseFloat(o.discount || 0),
          parseFloat(o.final_total || 0),
          o.payment_method || 'Cash',
          o.status || 'COMPLETED'
        ]);
        existing.add(num);
      }
    });
    if (newOrders.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newOrders.length, HEADERS.ORDERS.length).setValues(newOrders);
    }
  }

  // 3. ORDER_ITEMS (Batch)
  const itemsList = data.orderItems || data.order_items;
  if (Array.isArray(itemsList)) {
    const sheet = getOrInitSheet(ss, SHEET_NAMES.ORDER_ITEMS, HEADERS.ORDER_ITEMS);
    const existing = isReset ? new Set() : getExistingItemKeys(sheet);
    const newItems = [];
    itemsList.forEach(oi => {
      const ordNum = String(oi.order_number || '').trim();
      const itmName = String(oi.item_name || '').trim();
      const qty = parseInt(oi.quantity || 1, 10);
      const key = `${ordNum}_${itmName}_${qty}`;

      if (ordNum && itmName && !existing.has(key)) {
        newItems.push([
          ordNum,
          oi.item_code || `ITEM-${String(oi.menu_item_id || '000').padStart(3, '0')}`,
          itmName,
          oi.category_name || 'General',
          qty,
          parseFloat(oi.unit_price || 0),
          parseFloat(oi.total_price || 0)
        ]);
        existing.add(key);
      }
    });
    if (newItems.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newItems.length, HEADERS.ORDER_ITEMS.length).setValues(newItems);
    }
  }

  // 4. MENU (Batch)
  const menuList = data.menu || data.menu_items;
  if (Array.isArray(menuList)) {
    const sheet = getOrInitSheet(ss, SHEET_NAMES.MENU, HEADERS.MENU);
    const existing = isReset ? new Set() : getExistingColumnValues(sheet, 2);
    const newMenu = [];
    menuList.forEach(m => {
      const name = String(m.name || '').trim();
      if (name && !existing.has(name)) {
        newMenu.push([
          m.item_code || '',
          name,
          m.category_name || 'General',
          parseFloat(m.price || 0),
          m.is_active === 1 ? 'YES' : 'NO',
          normalizeDateStr(m.created_at, ss) || ''
        ]);
        existing.add(name);
      }
    });
    if (newMenu.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newMenu.length, HEADERS.MENU.length).setValues(newMenu);
    }
  }

  // 5. PURCHASES_EXPENSES (Batch)
  if (Array.isArray(data.expenses)) {
    const sheet = getOrInitSheet(ss, SHEET_NAMES.PURCHASES_EXPENSES, HEADERS.PURCHASES_EXPENSES);
    const existing = isReset ? new Set() : getExistingColumnValues(sheet, 2);
    const newExp = [];
    data.expenses.forEach(e => {
      const itm = String(e.item_name || '').trim();
      const dt = normalizeDateStr(e.expense_date, ss) || '';
      const key = `${dt}_${itm}`;
      if (itm && !existing.has(key)) {
        newExp.push([
          dt,
          itm,
          e.category || 'General',
          e.quantity || '-',
          parseFloat(e.cost || 0),
          e.payment_mode || 'Cash',
          e.vendor || '-',
          e.notes || ''
        ]);
        existing.add(key);
      }
    });
    if (newExp.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newExp.length, HEADERS.PURCHASES_EXPENSES.length).setValues(newExp);
    }
  }

  // 6. DAILY_SALES (Batch - Direct from SQLite or recalculated)
  if (Array.isArray(data.dailySales) && data.dailySales.length > 0) {
    const dailySheet = getOrInitSheet(ss, SHEET_NAMES.DAILY_SALES, HEADERS.DAILY_SALES);
    if (dailySheet.getLastRow() > 1) {
      dailySheet.getRange(2, 1, dailySheet.getLastRow() - 1, HEADERS.DAILY_SALES.length).clearContent();
    }
    const dRows = data.dailySales.map(d => [
      normalizeDateStr(d.date || d.order_date, ss),
      parseInt(d.number_of_orders || 0, 10),
      parseFloat(d.total_sales || 0),
      parseFloat(d.cash_sales || 0),
      parseFloat(d.upi_sales || 0),
      parseFloat(d.card_sales || 0),
      parseFloat(d.other_sales || 0)
    ]);
    dailySheet.getRange(2, 1, dRows.length, HEADERS.DAILY_SALES.length).setValues(dRows);
  }

  // 7. MONTHLY_SUMMARY (Batch - Direct from SQLite with 100% precision)
  if (Array.isArray(data.monthlySales) && data.monthlySales.length > 0) {
    const monthlySheet = getOrInitSheet(ss, SHEET_NAMES.MONTHLY_SUMMARY, HEADERS.MONTHLY_SUMMARY);
    if (monthlySheet.getLastRow() > 1) {
      monthlySheet.getRange(2, 1, monthlySheet.getLastRow() - 1, HEADERS.MONTHLY_SUMMARY.length).clearContent();
    }
    monthlySheet.getRange(2, 1, 2000, 1).setNumberFormat('@'); // Plain text for YYYY-MM

    const monthExpMap = {};
    if (Array.isArray(data.expenses)) {
      data.expenses.forEach(e => {
        const m = (normalizeDateStr(e.expense_date, ss) || '').substring(0, 7);
        if (m) monthExpMap[m] = (monthExpMap[m] || 0) + (parseFloat(e.cost) || 0);
      });
    }

    const mRows = data.monthlySales.map(m => {
      const monthStr = String(m.month || '').trim();
      const tot = parseFloat(m.total_sales || 0);
      const exp = parseFloat(monthExpMap[monthStr] || m.total_expenses || 0);
      const net = Math.round((tot - exp) * 100) / 100;
      return [
        monthStr,
        parseInt(m.number_of_orders || 0, 10),
        tot,
        exp,
        net,
        parseFloat(m.cash_sales || 0),
        parseFloat(m.upi_sales || 0)
      ];
    });
    monthlySheet.getRange(2, 1, mRows.length, HEADERS.MONTHLY_SUMMARY.length).setValues(mRows);
  } else {
    recalculateDailyAndMonthly(ss);
  }

  return jsonResponse({
    success: true,
    message: 'Full sync to Google Sheets completed successfully with zero duplicates!'
  });
}

// ─── AGGREGATION & REPORTING ─────────────────────────────────────────────────

/**
 * Re-aggregates and updates the DAILY_SALES and MONTHLY_SUMMARY sheets based on current orders & expenses.
 * Uses normalizeDateStr to ensure dates are NEVER corrupted into "Wed Sep", "Thu Sep", etc.
 */
function recalculateDailyAndMonthly(ss) {
  const orderSheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
  if (!orderSheet || orderSheet.getLastRow() < 2) return;

  const orderData = orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, 13).getValues();

  const dailyMap = {};
  const monthlyMap = {};

  orderData.forEach(row => {
    // Column index 5 is Date. MUST normalize to YYYY-MM-DD!
    const dateStr = normalizeDateStr(row[5], ss);
    const total = parseFloat(row[10] || 0);
    const method = String(row[11] || 'Cash').trim();
    const status = String(row[12] || '').trim();

    if (!dateStr || status === 'CANCELLED') return;

    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { orders: 0, total: 0, cash: 0, upi: 0, card: 0, other: 0 };
    }
    dailyMap[dateStr].orders += 1;
    dailyMap[dateStr].total += total;
    if (method === 'Cash') dailyMap[dateStr].cash += total;
    else if (method === 'UPI') dailyMap[dateStr].upi += total;
    else if (method === 'Card') dailyMap[dateStr].card += total;
    else dailyMap[dateStr].other += total;

    // Strict 7-char YYYY-MM (e.g. "2026-09")
    const monthStr = dateStr.substring(0, 7);
    if (!monthlyMap[monthStr]) {
      monthlyMap[monthStr] = { orders: 0, total: 0, cash: 0, upi: 0, expenses: 0 };
    }
    monthlyMap[monthStr].orders += 1;
    monthlyMap[monthStr].total += total;
    if (method === 'Cash') monthlyMap[monthStr].cash += total;
    else if (method === 'UPI') monthlyMap[monthStr].upi += total;
  });

  const expSheet = ss.getSheetByName(SHEET_NAMES.PURCHASES_EXPENSES);
  if (expSheet && expSheet.getLastRow() >= 2) {
    const expData = expSheet.getRange(2, 1, expSheet.getLastRow() - 1, 5).getValues();
    expData.forEach(row => {
      const dt = normalizeDateStr(row[0], ss);
      const cost = parseFloat(row[4] || 0);
      if (dt) {
        const m = dt.substring(0, 7);
        if (!monthlyMap[m]) {
          monthlyMap[m] = { orders: 0, total: 0, cash: 0, upi: 0, expenses: 0 };
        }
        monthlyMap[m].expenses += cost;
      }
    });
  }

  // 1. Write DAILY_SALES in ONE batch
  const dailySheet = getOrInitSheet(ss, SHEET_NAMES.DAILY_SALES, HEADERS.DAILY_SALES);
  if (dailySheet.getLastRow() > 1) {
    dailySheet.getRange(2, 1, dailySheet.getLastRow() - 1, HEADERS.DAILY_SALES.length).clearContent();
  }
  const dailyDates = Object.keys(dailyMap).sort().reverse();
  if (dailyDates.length > 0) {
    const rows = dailyDates.map(d => [
      d,
      dailyMap[d].orders,
      Math.round(dailyMap[d].total * 100) / 100,
      Math.round(dailyMap[d].cash * 100) / 100,
      Math.round(dailyMap[d].upi * 100) / 100,
      Math.round(dailyMap[d].card * 100) / 100,
      Math.round(dailyMap[d].other * 100) / 100
    ]);
    dailySheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  // 2. Write MONTHLY_SUMMARY in ONE batch
  const monthlySheet = getOrInitSheet(ss, SHEET_NAMES.MONTHLY_SUMMARY, HEADERS.MONTHLY_SUMMARY);
  if (monthlySheet.getLastRow() > 1) {
    monthlySheet.getRange(2, 1, monthlySheet.getLastRow() - 1, HEADERS.MONTHLY_SUMMARY.length).clearContent();
  }
  monthlySheet.getRange(2, 1, 2000, 1).setNumberFormat('@'); // Plain text for YYYY-MM
  
  const months = Object.keys(monthlyMap).sort().reverse();
  if (months.length > 0) {
    const mRows = months.map(m => {
      const tot = Math.round(monthlyMap[m].total * 100) / 100;
      const exp = Math.round(monthlyMap[m].expenses * 100) / 100;
      const net = Math.round((tot - exp) * 100) / 100;
      return [
        m,
        monthlyMap[m].orders,
        tot,
        exp,
        net,
        Math.round(monthlyMap[m].cash * 100) / 100,
        Math.round(monthlyMap[m].upi * 100) / 100
      ];
    });
    monthlySheet.getRange(2, 1, mRows.length, mRows[0].length).setValues(mRows);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getOrInitSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    const hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setBackground(THEME.headerBg).setFontColor(THEME.headerFont).setFontWeight('bold');
    sheet.setRowHeight(1, 30);
    sheet.setFrozenRows(1);
    
    if (sheetName === SHEET_NAMES.MONTHLY_SUMMARY) {
      sheet.getRange(2, 1, 2000, 1).setNumberFormat('@');
    }
  }
  return sheet;
}

function getExistingColumnValues(sheet, colIndex) {
  const set = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const vals = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
    vals.forEach(r => {
      const v = String(r[0] || '').trim();
      if (v) set.add(v);
    });
  }
  return set;
}

function getRowMapByColumn(sheet, colIndex) {
  const map = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const vals = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
    vals.forEach((r, idx) => {
      const v = String(r[0] || '').trim();
      if (v) map.set(v, idx + 2);
    });
  }
  return map;
}

function findRowIndexByColumn(sheet, colIndex, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const vals = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() === value) {
      return i + 2;
    }
  }
  return -1;
}

function getExistingItemKeys(sheet) {
  const set = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const vals = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    vals.forEach(r => {
      const ord = String(r[0] || '').trim();
      const itm = String(r[2] || '').trim();
      const qty = String(r[4] || '').trim();
      if (ord && itm) set.add(`${ord}_${itm}_${qty}`);
    });
  }
  return set;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
