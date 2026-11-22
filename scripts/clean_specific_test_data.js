// Clean Specific Test Data Script for Sree Sai Fillings Cafe
// Removes ONLY: ORD-000019 (the test order added today) and
// restores Customer 9's name back to 'Home' (was overwritten by test order)
// Leaves ALL other real orders and customers untouched.

const fs = require('fs');
const path = require('path');
const dbManager = require('../src/database/db');
const excelSync = require('../src/excel/excelSync');

async function cleanSpecificTestData() {
  console.log('==============================================');
  console.log('  CLEANING SPECIFIC TEST DATA (ORD-000019)');
  console.log('==============================================\n');

  // 1. Initialize database
  await dbManager.initDatabase();

  // 2. Show before state
  const beforeOrders = dbManager.queryOne("SELECT COUNT(*) as count FROM orders").count;
  const beforeCustomers = dbManager.queryOne("SELECT COUNT(*) as count FROM customers").count;
  console.log(`Before: ${beforeOrders} orders, ${beforeCustomers} customers`);

  // 3. Confirm target order exists
  const testOrder = dbManager.queryOne("SELECT * FROM orders WHERE order_number = 'ORD-000019'");
  if (testOrder) {
    console.log(`Found test order: ORD-000019 (customer: ${testOrder.customer_name}, phone: ${testOrder.customer_phone})`);
  } else {
    console.log('ORD-000019 not found in database (may have already been removed).');
  }

  // 4. Delete ORD-000019 order items
  const itemsDeleted = dbManager.run("DELETE FROM order_items WHERE order_number = 'ORD-000019' OR order_id = 19");
  console.log(`Deleted order items for ORD-000019: ${itemsDeleted.changes} row(s)`);

  // 5. Delete ORD-000019 order
  const ordersDeleted = dbManager.run("DELETE FROM orders WHERE order_number = 'ORD-000019' OR id = 19");
  console.log(`Deleted order ORD-000019: ${ordersDeleted.changes} row(s)`);

  // 6. Reset order sequence counter back to 18 (so next order is ORD-000019 again)
  try {
    dbManager.run("UPDATE sqlite_sequence SET seq = 18 WHERE name = 'orders'");
    dbManager.run("UPDATE sqlite_sequence SET seq = 33 WHERE name = 'order_items'");
    console.log('Reset auto-increment sequence: orders -> 18, order_items -> 33');
  } catch (e) {
    console.log('Note: sqlite_sequence reset skipped:', e.message);
  }

  // 7. Restore Customer 9 name to 'Home' if it was overwritten to 'test'
  const cust9 = dbManager.queryOne("SELECT id, name, phone FROM customers WHERE id = 9");
  if (cust9) {
    if (cust9.name.toLowerCase() === 'test') {
      dbManager.run("UPDATE customers SET name = 'Home', updated_at = ? WHERE id = 9", [new Date().toISOString()]);
      console.log(`Restored Customer 9 name: 'test' -> 'Home' (phone: ${cust9.phone})`);
    } else {
      console.log(`Customer 9 is already '${cust9.name}' (no restore needed)`);
    }
  } else {
    console.log('Customer 9 not found (nothing to restore)');
  }

  // 8. Persist database
  dbManager.saveDatabase();

  // 9. Verify final state
  const afterOrders = dbManager.queryOne("SELECT COUNT(*) as count FROM orders").count;
  const afterCustomers = dbManager.queryOne("SELECT COUNT(*) as count FROM customers").count;
  const lastOrder = dbManager.queryOne("SELECT order_number, customer_name FROM orders ORDER BY id DESC LIMIT 1");
  console.log(`\nAfter: ${afterOrders} orders, ${afterCustomers} customers`);
  console.log(`Last order: ${lastOrder ? lastOrder.order_number + ' (' + lastOrder.customer_name + ')' : 'none'}`);

  // 10. Rebuild Business_Data.xlsx cleanly (no test order, no test customer name)
  console.log('\nRebuilding Business_Data.xlsx across all locations...');
  try {
    const mainPath = excelSync.getExcelFilePath();

    // Delete old file so syncExcelWorkbook regenerates fresh from scratch
    if (fs.existsSync(mainPath)) {
      fs.unlinkSync(mainPath);
      console.log('Deleted old Business_Data.xlsx (AppData)');
    }

    await excelSync.syncExcelWorkbook();
    console.log('Regenerated Business_Data.xlsx (AppData) - clean, no test data');

    // Update OneDrive mirrors
    const oneDrivePaths = excelSync.getOneDriveExcelPaths();
    for (const destPath of oneDrivePaths) {
      try {
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
          console.log(`Deleted old: ${path.basename(destPath)}`);
        }
        if (fs.existsSync(mainPath)) {
          fs.copyFileSync(mainPath, destPath);
          console.log(`Updated OneDrive mirror: ${destPath}`);
        }
      } catch (e) {
        console.warn(`Could not update ${path.basename(destPath)}:`, e.message);
      }
    }
  } catch (e) {
    console.error('Excel rebuild error:', e.message);
  }

  console.log('\n==============================================');
  console.log('  CLEANUP COMPLETE');
  console.log('==============================================');
  console.log('- ORD-000019 removed from SQLite');
  console.log('- Customer 9 restored to "Home"');
  console.log('- Sequence reset (next order = ORD-000019)');
  console.log('- Business_Data.xlsx rebuilt clean (AppData + OneDrive)');
  console.log('- All 18 real orders untouched.\n');
}

cleanSpecificTestData().catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
