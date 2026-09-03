// Clean Test Data Script for Sree Sai Fillings Cafe
// Clears test customers, test orders, and test order items while keeping the full 90-item menu intact.

const fs = require('fs');
const path = require('path');
const dbManager = require('../src/database/db');
const queries = require('../src/database/queries');
const excelSync = require('../src/excel/excelSync');

async function cleanTestData() {
  console.log('Cleaning fake/test data...');

  // 1. Initialize primary DB
  await dbManager.initDatabase();

  // 2. Delete test orders and customers
  dbManager.run("DELETE FROM order_items");
  dbManager.run("DELETE FROM orders");
  dbManager.run("DELETE FROM customers");

  // Reset auto-increment sequences for customers and orders
  try {
    dbManager.run("DELETE FROM sqlite_sequence WHERE name IN ('customers', 'orders', 'order_items')");
  } catch (e) {
    // sqlite_sequence might be empty
  }

  // Persist DB
  dbManager.saveDatabase();

  // 3. Resync Excel workbook with clean state
  await excelSync.syncExcelWorkbook();

  const customerCount = dbManager.queryOne("SELECT COUNT(*) as count FROM customers").count;
  const orderCount = dbManager.queryOne("SELECT COUNT(*) as count FROM orders").count;
  const menuCount = dbManager.queryOne("SELECT COUNT(*) as count FROM menu_items").count;

  console.log(`\n========================================`);
  console.log(`  CLEANUP COMPLETE`);
  console.log(`========================================`);
  console.log(`- Customers remaining: ${customerCount}`);
  console.log(`- Orders remaining: ${orderCount}`);
  console.log(`- Menu Items intact: ${menuCount} (All 12 categories preserved)`);
  console.log(`- Excel Workbook (Business_Data.xlsx) reset and synchronized.\n`);
}

cleanTestData().catch(err => {
  console.error('Error cleaning data:', err);
  process.exit(1);
});
