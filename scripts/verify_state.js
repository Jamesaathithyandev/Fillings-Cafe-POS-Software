const dbManager = require('../src/database/db');
const { isTestCustomerName } = require('../src/database/queries');

(async () => {
  await dbManager.initDatabase();

  console.log('--- DB VERIFICATION ---');
  const orders = dbManager.queryAll('SELECT order_number, customer_name, final_total, order_date FROM orders ORDER BY id DESC LIMIT 5');
  console.table(orders);

  const cust9 = dbManager.queryOne('SELECT id, name, phone FROM customers WHERE id = 9');
  console.log('Customer 9:', cust9);

  const testOrders = dbManager.queryAll("SELECT order_number FROM orders WHERE customer_name = 'test'");
  console.log('Test orders remaining:', testOrders.length, '(should be 0)');

  console.log('--- TEST MODE GUARD ---');
  const names = ['test', 'Test', 'TEST', 'testing', 'test order', 'James', 'Rohini'];
  names.forEach(n => console.log('  isTest("' + n + '"):', isTestCustomerName(n)));

  console.log('--- SEQUENCE ---');
  const seq = dbManager.queryAll("SELECT * FROM sqlite_sequence WHERE name IN ('orders','order_items')");
  console.table(seq);

  // Test mock order creation
  const queries = require('../src/database/queries');
  const mockOrder = queries.saveOrder({
    customer: { name: 'test', phone: '' },
    items: [{ id: 1, name: 'Test Item', category: 'TEST', price: 99, quantity: 2 }],
    payment_method: 'Cash'
  });
  console.log('--- MOCK TEST ORDER ---');
  console.log('is_test:', mockOrder.is_test);
  console.log('order_number:', mockOrder.order_number);
  console.log('final_total:', mockOrder.final_total);

  // Verify DB still has 18 orders (mock order NOT saved)
  const finalCount = dbManager.queryOne("SELECT COUNT(*) as count FROM orders").count;
  console.log('Total orders after mock test order:', finalCount, '(should still be 18)');
})();
