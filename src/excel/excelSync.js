// Sree Sai Fillings Cafe - Excel Sync & Reporting Engine
// Generates and synchronizes Business_Data.xlsx with 6 dedicated sheets

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const dbManager = require('../database/db');
const queries = require('../database/queries');

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
 * Format a worksheet with styled headers, alternating row colors, borders, and auto column widths
 */
function applySheetFormatting(sheet, columnsConfig) {
  sheet.columns = columnsConfig;

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

    row.eachCell((cell, colNumber) => {
      cell.font = STYLES.dataFont;
      cell.border = STYLES.thinBorder;
      if (isEven) cell.fill = STYLES.zebraFill;

      // Align based on column config
      const col = columnsConfig[colNumber - 1];
      if (col && col.align) {
        cell.alignment = { vertical: 'middle', horizontal: col.align };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // Format currency or numbers
      if (col && col.numFmt) {
        cell.numFmt = col.numFmt;
      }
    });
  });

  // Auto column width calculation with safety bounds
  sheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value ? cell.value.toString() : '';
      if (val.length > maxLen) maxLen = val.length;
    });
    column.width = Math.min(Math.max(maxLen + 4, 12), 40);
  });
}

/**
 * Build the multi-sheet workbook containing all 6 business sheets
 */
async function generateWorkbook() {
  const data = queries.getFullExcelDataset();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sree Sai Fillings Cafe POS';
  workbook.lastModifiedBy = 'Sree Sai Fillings Cafe POS';
  workbook.created = new Date();
  workbook.modified = new Date();

  // ----------------------------------------------------
  // SHEET 1: CUSTOMERS
  // ----------------------------------------------------
  const customerSheet = workbook.addWorksheet('CUSTOMERS', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const customerCols = [
    { header: 'Customer ID', key: 'customer_code', width: 16, align: 'center' },
    { header: 'Customer Name', key: 'name', width: 22, align: 'left' },
    { header: 'Phone', key: 'phone', width: 16, align: 'center' },
    { header: 'Email', key: 'email', width: 22, align: 'left' },
    { header: 'Address', key: 'address', width: 28, align: 'left' },
    { header: 'Date Created', key: 'created_at', width: 16, align: 'center' },
    { header: 'Total Orders', key: 'total_orders', width: 14, align: 'right', numFmt: '#,##0' },
    { header: 'Total Spent (₹)', key: 'total_spent', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Last Order Date', key: 'last_order_date', width: 16, align: 'center' }
  ];

  data.customers.forEach((c) => {
    const createdDate = c.created_at ? c.created_at.split('T')[0] : '';
    customerSheet.addRow({
      customer_code: c.customer_code || `CUST-${c.id}`,
      name: c.name,
      phone: c.phone,
      email: c.email || '-',
      address: c.address || '-',
      created_at: createdDate,
      total_orders: c.total_orders || 0,
      total_spent: c.total_spent || 0,
      last_order_date: c.last_order_date || 'N/A'
    });
  });
  applySheetFormatting(customerSheet, customerCols);

  // ----------------------------------------------------
  // SHEET 2: ORDERS
  // ----------------------------------------------------
  const orderSheet = workbook.addWorksheet('ORDERS', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const orderCols = [
    { header: 'Order ID', key: 'order_number', width: 16, align: 'center' },
    { header: 'Customer ID', key: 'customer_code', width: 16, align: 'center' },
    { header: 'Customer Name', key: 'customer_name', width: 22, align: 'left' },
    { header: 'Phone', key: 'customer_phone', width: 16, align: 'center' },
    { header: 'Date', key: 'order_date', width: 14, align: 'center' },
    { header: 'Time', key: 'order_time', width: 12, align: 'center' },
    { header: 'Subtotal (₹)', key: 'subtotal', width: 14, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Discount (₹)', key: 'discount', width: 14, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Final Total (₹)', key: 'final_total', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Payment Method', key: 'payment_method', width: 16, align: 'center' },
    { header: 'Status', key: 'status', width: 14, align: 'center' }
  ];

  data.orders.forEach((o) => {
    orderSheet.addRow({
      order_number: o.order_number,
      customer_code: `CUST-${String(o.customer_id).padStart(6, '0')}`,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      order_date: o.order_date,
      order_time: o.order_time,
      subtotal: o.subtotal,
      discount: o.discount,
      final_total: o.final_total,
      payment_method: o.payment_method,
      status: o.status
    });
  });
  applySheetFormatting(orderSheet, orderCols);

  // ----------------------------------------------------
  // SHEET 3: ORDER_ITEMS
  // ----------------------------------------------------
  const orderItemsSheet = workbook.addWorksheet('ORDER_ITEMS', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const orderItemCols = [
    { header: 'Order ID', key: 'order_number', width: 16, align: 'center' },
    { header: 'Item ID', key: 'item_code', width: 14, align: 'center' },
    { header: 'Item Name', key: 'item_name', width: 26, align: 'left' },
    { header: 'Category', key: 'category_name', width: 20, align: 'left' },
    { header: 'Quantity', key: 'quantity', width: 12, align: 'right', numFmt: '#,##0' },
    { header: 'Unit Price (₹)', key: 'unit_price', width: 14, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Total (₹)', key: 'total_price', width: 16, align: 'right', numFmt: '₹#,##0.00' }
  ];

  data.orderItems.forEach((oi) => {
    orderItemsSheet.addRow({
      order_number: oi.order_number,
      item_code: oi.item_code || `ITEM-${oi.menu_item_id || '000'}`,
      item_name: oi.item_name,
      category_name: oi.category_name,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      total_price: oi.total_price
    });
  });
  applySheetFormatting(orderItemsSheet, orderItemCols);

  // ----------------------------------------------------
  // SHEET 4: MENU
  // ----------------------------------------------------
  const menuSheet = workbook.addWorksheet('MENU', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const menuCols = [
    { header: 'Item ID', key: 'item_code', width: 14, align: 'center' },
    { header: 'Item Name', key: 'name', width: 28, align: 'left' },
    { header: 'Category', key: 'category_name', width: 22, align: 'left' },
    { header: 'Price (₹)', key: 'price', width: 14, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Active', key: 'is_active', width: 12, align: 'center' },
    { header: 'Date Added', key: 'created_at', width: 16, align: 'center' }
  ];

  data.menu.forEach((m) => {
    const createdDate = m.created_at ? m.created_at.split('T')[0] : '';
    menuSheet.addRow({
      item_code: m.item_code,
      name: m.name,
      category_name: m.category_name,
      price: m.price,
      is_active: m.is_active === 1 ? 'YES' : 'NO',
      created_at: createdDate
    });
  });
  applySheetFormatting(menuSheet, menuCols);

  // ----------------------------------------------------
  // SHEET 5: DAILY_SALES
  // ----------------------------------------------------
  const dailySheet = workbook.addWorksheet('DAILY_SALES', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const dailyCols = [
    { header: 'Date', key: 'date', width: 16, align: 'center' },
    { header: 'Number of Orders', key: 'number_of_orders', width: 18, align: 'right', numFmt: '#,##0' },
    { header: 'Total Sales (₹)', key: 'total_sales', width: 18, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Cash Sales (₹)', key: 'cash_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'UPI Sales (₹)', key: 'upi_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Card Sales (₹)', key: 'card_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Other Sales (₹)', key: 'other_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' }
  ];

  data.dailySales.forEach((d) => {
    dailySheet.addRow({
      date: d.date,
      number_of_orders: d.number_of_orders,
      total_sales: d.total_sales,
      cash_sales: d.cash_sales,
      upi_sales: d.upi_sales,
      card_sales: d.card_sales,
      other_sales: d.other_sales
    });
  });
  applySheetFormatting(dailySheet, dailyCols);

  // ----------------------------------------------------
  // SHEET 6: MONTHLY_SALES
  // ----------------------------------------------------
  const monthlySheet = workbook.addWorksheet('MONTHLY_SALES', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const monthlyCols = [
    { header: 'Month', key: 'month', width: 16, align: 'center' },
    { header: 'Number of Orders', key: 'number_of_orders', width: 18, align: 'right', numFmt: '#,##0' },
    { header: 'Total Sales (₹)', key: 'total_sales', width: 18, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Cash Sales (₹)', key: 'cash_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'UPI Sales (₹)', key: 'upi_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Card Sales (₹)', key: 'card_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' },
    { header: 'Other Sales (₹)', key: 'other_sales', width: 16, align: 'right', numFmt: '₹#,##0.00' }
  ];

  data.monthlySales.forEach((m) => {
    monthlySheet.addRow({
      month: m.month,
      number_of_orders: m.number_of_orders,
      total_sales: m.total_sales,
      cash_sales: m.cash_sales,
      upi_sales: m.upi_sales,
      card_sales: m.card_sales,
      other_sales: m.other_sales
    });
  });
  applySheetFormatting(monthlySheet, monthlyCols);

  return workbook;
}

/**
 * Synchronize local Excel workbook (Business_Data.xlsx) safely.
 * Non-blocking if file is locked.
 */
async function syncExcelWorkbook() {
  const filePath = getExcelFilePath();
  try {
    const workbook = await generateWorkbook();
    await workbook.xlsx.writeFile(filePath);

    lastSyncTime = new Date().toISOString();
    lastSyncStatus = {
      success: true,
      locked: false,
      lastSync: lastSyncTime,
      filePath: filePath,
      message: 'Excel synchronized successfully.'
    };
    return lastSyncStatus;
  } catch (err) {
    console.warn('Excel Sync Warning:', err.message);
    const isLocked = err.code === 'EBUSY' || err.code === 'EPERM' || err.message.includes('busy') || err.message.includes('locked');
    
    lastSyncStatus = {
      success: false,
      locked: isLocked,
      lastSync: lastSyncTime,
      filePath: filePath,
      message: isLocked 
        ? 'Business_Data.xlsx is currently open in Excel. Close it and click "Sync Now" to update.'
        : `Excel sync failed: ${err.message}`
    };
    return lastSyncStatus;
  }
}

/**
 * Export full Excel workbook to a custom user chosen location
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

function getSyncStatus() {
  return {
    ...lastSyncStatus,
    filePath: getExcelFilePath(),
    lastSyncTime
  };
}

module.exports = {
  getExcelFilePath,
  syncExcelWorkbook,
  exportExcelToCustomPath,
  getSyncStatus
};
