// Sree Sai Fillings Cafe - Database Queries & Business Logic

const db = require('./db');

/**
 * Format ID helpers
 */
function padZero(num, size = 6) {
  let s = num + '';
  while (s.length < size) s = '0' + s;
  return s;
}

function generateCustomerCode(id) {
  return `CUST-${padZero(id, 6)}`;
}

function generateOrderNumber(id) {
  return `ORD-${padZero(id, 6)}`;
}

// ==========================================
// 1. CUSTOMERS
// ==========================================

function getCustomerById(id) {
  const customer = db.queryOne("SELECT * FROM customers WHERE id = ?", [id]);
  if (!customer) return null;

  // Enrich with dynamic calculated metrics
  const stats = db.queryOne(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(final_total), 0) as total_spent,
      MAX(order_date) as last_order_date,
      MIN(order_date) as first_order_date
    FROM orders 
    WHERE customer_id = ? AND status = 'COMPLETED'
  `, [id]);

  return {
    ...customer,
    total_orders: stats ? stats.total_orders : 0,
    total_spent: stats ? stats.total_spent : 0,
    last_order_date: stats ? (stats.last_order_date || 'N/A') : 'N/A',
    first_order_date: stats ? (stats.first_order_date || 'N/A') : 'N/A'
  };
}

function getCustomerByPhone(phone) {
  if (!phone) return null;
  const cleanPhone = phone.trim();
  const customer = db.queryOne("SELECT * FROM customers WHERE phone = ?", [cleanPhone]);
  if (!customer) return null;
  return getCustomerById(customer.id);
}

function searchCustomers(query, limit = 20) {
  if (!query || !query.trim()) {
    // Return most active or recent customers
    const rows = db.queryAll(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as total_orders,
        (SELECT COALESCE(SUM(final_total), 0) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as total_spent,
        (SELECT MAX(order_date) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as last_order_date
      FROM customers c
      ORDER BY c.id DESC
      LIMIT ?
    `, [limit]);
    return rows;
  }

  const cleanQuery = `%${query.trim()}%`;
  const rows = db.queryAll(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as total_orders,
      (SELECT COALESCE(SUM(final_total), 0) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as total_spent,
      (SELECT MAX(order_date) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as last_order_date
    FROM customers c
    WHERE c.phone LIKE ? OR c.name LIKE ? OR c.email LIKE ? OR c.customer_code LIKE ?
    ORDER BY 
      CASE WHEN c.phone = ? THEN 1
           WHEN c.phone LIKE ? THEN 2
           WHEN c.name LIKE ? THEN 3
           ELSE 4 END,
      c.id DESC
    LIMIT ?
  `, [cleanQuery, cleanQuery, cleanQuery, cleanQuery, query.trim(), `${query.trim()}%`, `${query.trim()}%`, limit]);
  return rows;
}

function getAllCustomers() {
  return db.queryAll(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as total_orders,
      (SELECT COALESCE(SUM(final_total), 0) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as total_spent,
      (SELECT MAX(order_date) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as last_order_date,
      (SELECT MIN(order_date) FROM orders WHERE customer_id = c.id AND status = 'COMPLETED') as first_order_date
    FROM customers c
    ORDER BY c.id DESC
  `);
}

function createOrUpdateCustomer(customerData) {
  const { name, phone, email = '', address = '', notes = '' } = customerData;
  if (!name || !phone) {
    throw new Error('Customer Name and Phone number are required.');
  }

  const cleanPhone = phone.trim();
  const cleanName = name.trim();
  const now = new Date().toISOString();

  // Check if exists
  const existing = db.queryOne("SELECT id, customer_code FROM customers WHERE phone = ?", [cleanPhone]);
  if (existing) {
    db.run(`
      UPDATE customers 
      SET name = ?, email = ?, address = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `, [cleanName, email.trim(), address.trim(), notes.trim(), now, existing.id]);
    return getCustomerById(existing.id);
  } else {
    // Determine next ID for customer_code
    const maxRes = db.queryOne("SELECT MAX(id) as max_id FROM customers");
    const nextId = (maxRes && maxRes.max_id ? maxRes.max_id : 0) + 1;
    const customerCode = generateCustomerCode(nextId);

    const res = db.run(`
      INSERT INTO customers (customer_code, name, phone, email, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [customerCode, cleanName, cleanPhone, email.trim(), address.trim(), notes.trim(), now, now]);

    return getCustomerById(res.lastInsertRowid);
  }
}

// ==========================================
// 2. MENU ITEMS & CATEGORIES
// ==========================================

function getAllCategories() {
  return db.queryAll("SELECT * FROM categories ORDER BY display_order ASC, name ASC");
}

function getAllMenuItems(onlyActive = false) {
  const sql = onlyActive 
    ? "SELECT * FROM menu_items WHERE is_active = 1 ORDER BY category_name ASC, name ASC"
    : "SELECT * FROM menu_items ORDER BY category_name ASC, name ASC";
  return db.queryAll(sql);
}

function getMenuItemsByCategory(categoryId, onlyActive = true) {
  const sql = onlyActive
    ? "SELECT * FROM menu_items WHERE category_id = ? AND is_active = 1 ORDER BY name ASC"
    : "SELECT * FROM menu_items WHERE category_id = ? ORDER BY name ASC";
  return db.queryAll(sql, [categoryId]);
}

function addMenuItem(itemData) {
  const { category_id, name, price, description = '', image_path = '', is_active = 1 } = itemData;
  if (!category_id || !name || price === undefined || price === null) {
    throw new Error('Category, Name, and Price are required.');
  }

  const cat = db.queryOne("SELECT name FROM categories WHERE id = ?", [category_id]);
  const category_name = cat ? cat.name : 'GENERAL';

  const maxRes = db.queryOne("SELECT MAX(id) as max_id FROM menu_items");
  const nextId = (maxRes && maxRes.max_id ? maxRes.max_id : 0) + 1;
  const item_code = `ITEM-${padZero(nextId, 3)}`;
  const now = new Date().toISOString();

  const res = db.run(`
    INSERT INTO menu_items (item_code, category_id, category_name, name, price, description, image_path, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [item_code, category_id, category_name, name.trim(), parseFloat(price), description.trim(), image_path.trim(), is_active ? 1 : 0, now, now]);

  return db.queryOne("SELECT * FROM menu_items WHERE id = ?", [res.lastInsertRowid]);
}

function updateMenuItem(id, itemData) {
  const { category_id, name, price, description = '', image_path = '', is_active = 1 } = itemData;
  const now = new Date().toISOString();
  
  let category_name = null;
  if (category_id) {
    const cat = db.queryOne("SELECT name FROM categories WHERE id = ?", [category_id]);
    if (cat) category_name = cat.name;
  }

  const existing = db.queryOne("SELECT * FROM menu_items WHERE id = ?", [id]);
  if (!existing) throw new Error('Menu item not found');

  const finalCatId = category_id || existing.category_id;
  const finalCatName = category_name || existing.category_name;

  db.run(`
    UPDATE menu_items
    SET category_id = ?, category_name = ?, name = ?, price = ?, description = ?, image_path = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `, [finalCatId, finalCatName, name.trim(), parseFloat(price), description.trim(), image_path.trim(), is_active ? 1 : 0, now, id]);

  return db.queryOne("SELECT * FROM menu_items WHERE id = ?", [id]);
}

function toggleMenuItemStatus(id) {
  const existing = db.queryOne("SELECT is_active FROM menu_items WHERE id = ?", [id]);
  if (!existing) throw new Error('Menu item not found');
  const newStatus = existing.is_active === 1 ? 0 : 1;
  const now = new Date().toISOString();
  db.run("UPDATE menu_items SET is_active = ?, updated_at = ? WHERE id = ?", [newStatus, now, id]);
  return { id, is_active: newStatus };
}

function deleteMenuItem(id) {
  // Check if item was ever ordered
  const used = db.queryOne("SELECT COUNT(*) as count FROM order_items WHERE menu_item_id = ?", [id]);
  if (used && used.count > 0) {
    // Cannot hard delete to preserve historical integrity, mark inactive
    db.run("UPDATE menu_items SET is_active = 0 WHERE id = ?", [id]);
    return { success: true, message: 'Item has historical orders; deactivated instead of deleted.' };
  }
  db.run("DELETE FROM menu_items WHERE id = ?", [id]);
  return { success: true, message: 'Item deleted.' };
}

// ==========================================
// 3. ORDERS & BILLING
// ==========================================

function getNextOrderNumber() {
  const maxRes = db.queryOne("SELECT MAX(id) as max_id FROM orders");
  const nextId = (maxRes && maxRes.max_id ? maxRes.max_id : 0) + 1;
  return generateOrderNumber(nextId);
}

function saveOrder(orderPayload) {
  const {
    customer, // { id (optional), name, phone, email, address, notes }
    items,    // [ { id, name, category, quantity, price, item_code } ]
    discount = 0,
    discount_type = 'flat', // 'flat' or 'percent'
    payment_method = 'Cash',
    order_type = 'Dine-In',
    packaging_charge = 0,
    notes = ''
  } = orderPayload;

  if (!items || items.length === 0) {
    throw new Error('Order must contain at least one menu item.');
  }

  if (!customer || !customer.name || !customer.phone) {
    throw new Error('Customer Name and Phone Number are required.');
  }

  // 1. Ensure Customer exists / update customer
  const savedCustomer = createOrUpdateCustomer(customer);

  // 2. Compute Calculations
  let subtotal = 0;
  for (const item of items) {
    const qty = parseInt(item.quantity, 10) || 1;
    const unitPrice = parseFloat(item.price) || 0;
    subtotal += (qty * unitPrice);
  }

  let calculatedDiscount = 0;
  if (discount_type === 'percent') {
    calculatedDiscount = (subtotal * (parseFloat(discount) || 0)) / 100;
  } else {
    calculatedDiscount = parseFloat(discount) || 0;
  }
  if (calculatedDiscount > subtotal) calculatedDiscount = subtotal;

  const pkgCharge = parseFloat(packaging_charge) || 0;
  const finalTotal = Math.max(0, subtotal + pkgCharge - calculatedDiscount);

  // 3. Prepare Order Dates
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const order_date = `${year}-${month}-${day}`;
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const order_time = `${hours}:${minutes}:${seconds}`;

  const order_number = getNextOrderNumber();
  const created_at = now.toISOString();

  // 4. Save Order Header
  const orderRes = db.run(`
    INSERT INTO orders (
      order_number, customer_id, customer_name, customer_phone,
      order_date, order_time, subtotal, discount, discount_type,
      packaging_charge, order_type,
      final_total, payment_method, status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)
  `, [
    order_number, savedCustomer.id, savedCustomer.name, savedCustomer.phone,
    order_date, order_time, subtotal, calculatedDiscount, discount_type,
    pkgCharge, order_type,
    finalTotal, payment_method, notes.trim(), created_at
  ]);

  const orderId = orderRes.lastInsertRowid;

  // 5. Save Order Items (Historical Snapshot)
  for (const item of items) {
    const qty = parseInt(item.quantity, 10) || 1;
    const unitPrice = parseFloat(item.price) || 0;
    const totalPrice = qty * unitPrice;

    db.run(`
      INSERT INTO order_items (
        order_id, order_number, menu_item_id, item_code,
        item_name, category_name, quantity, unit_price, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderId, order_number, item.id || null, item.code || item.item_code || '',
      item.name, item.category || item.category_name || 'GENERAL',
      qty, unitPrice, totalPrice
    ]);
  }

  // Return the complete saved order structure
  return getOrderDetails(orderId);
}

function getOrderDetails(orderIdOrNumber) {
  let order = null;
  if (typeof orderIdOrNumber === 'string' && orderIdOrNumber.startsWith('ORD-')) {
    order = db.queryOne("SELECT * FROM orders WHERE order_number = ?", [orderIdOrNumber]);
  } else {
    order = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderIdOrNumber]);
  }

  if (!order) return null;

  const items = db.queryAll("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
  const customer = getCustomerById(order.customer_id);

  return {
    ...order,
    items,
    customer
  };
}

function getOrdersByCustomer(customerId) {
  return db.queryAll(`
    SELECT * FROM orders 
    WHERE customer_id = ? 
    ORDER BY id DESC
  `, [customerId]);
}

function getRecentOrders(limit = 20) {
  const rows = db.queryAll(`
    SELECT o.*, c.customer_code
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    ORDER BY o.id DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

function cancelOrder(orderId, reason = '') {
  const existing = db.queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!existing) throw new Error('Order not found');
  if (existing.status === 'CANCELLED') throw new Error('Order is already cancelled');

  const notes = existing.notes ? `${existing.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`;
  db.run("UPDATE orders SET status = 'CANCELLED', notes = ? WHERE id = ?", [notes.trim(), orderId]);

  return getOrderDetails(orderId);
}

// ==========================================
// 4. DASHBOARD & SALES REPORTS
// ==========================================

function getDashboardSummary() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayDate = `${year}-${month}-${day}`;
  const currentMonthPrefix = `${year}-${month}`;

  // Today
  const todayStats = db.queryOne(`
    SELECT 
      COUNT(*) as orders_count,
      COALESCE(SUM(final_total), 0) as total_sales
    FROM orders
    WHERE order_date = ? AND status = 'COMPLETED'
  `, [todayDate]);

  // This Month
  const monthStats = db.queryOne(`
    SELECT 
      COUNT(*) as orders_count,
      COALESCE(SUM(final_total), 0) as total_sales
    FROM orders
    WHERE order_date LIKE ? AND status = 'COMPLETED'
  `, [`${currentMonthPrefix}%`]);

  // All Time Customers & Orders
  const customerCount = db.queryOne("SELECT COUNT(*) as count FROM customers");
  const orderCount = db.queryOne("SELECT COUNT(*) as count, COALESCE(SUM(final_total), 0) as total_sales FROM orders WHERE status = 'COMPLETED'");

  const totalOrders = orderCount ? orderCount.count : 0;
  const totalSales = orderCount ? orderCount.total_sales : 0;
  const aov = totalOrders > 0 ? (totalSales / totalOrders) : 0;

  return {
    today: {
      date: todayDate,
      sales: todayStats ? todayStats.total_sales : 0,
      orders: todayStats ? todayStats.orders_count : 0
    },
    month: {
      month: currentMonthPrefix,
      sales: monthStats ? monthStats.total_sales : 0,
      orders: monthStats ? monthStats.orders_count : 0
    },
    totals: {
      customers: customerCount ? customerCount.count : 0,
      orders: totalOrders,
      sales: totalSales,
      averageOrderValue: Math.round(aov * 100) / 100
    }
  };
}

function getDailySales(limitDays = 60) {
  return db.queryAll(`
    SELECT 
      order_date as date,
      COUNT(*) as number_of_orders,
      COALESCE(SUM(final_total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN final_total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'UPI' THEN final_total ELSE 0 END), 0) as upi_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN final_total ELSE 0 END), 0) as card_sales,
      COALESCE(SUM(CASE WHEN payment_method NOT IN ('Cash', 'UPI', 'Card') THEN final_total ELSE 0 END), 0) as other_sales,
      COALESCE(AVG(final_total), 0) as average_order_value
    FROM orders
    WHERE status = 'COMPLETED'
    GROUP BY order_date
    ORDER BY order_date DESC
    LIMIT ?
  `, [limitDays]);
}

function getMonthlySales() {
  return db.queryAll(`
    SELECT 
      SUBSTR(order_date, 1, 7) as month,
      COUNT(*) as number_of_orders,
      COALESCE(SUM(final_total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN final_total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'UPI' THEN final_total ELSE 0 END), 0) as upi_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN final_total ELSE 0 END), 0) as card_sales,
      COALESCE(SUM(CASE WHEN payment_method NOT IN ('Cash', 'UPI', 'Card') THEN final_total ELSE 0 END), 0) as other_sales,
      COALESCE(AVG(final_total), 0) as average_order_value
    FROM orders
    WHERE status = 'COMPLETED'
    GROUP BY SUBSTR(order_date, 1, 7)
    ORDER BY month DESC
  `);
}

function getDateRangeReport(fromDate, toDate) {
  const summary = db.queryOne(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(final_total), 0) as total_sales,
      COALESCE(AVG(final_total), 0) as average_order_value,
      COUNT(DISTINCT customer_id) as unique_customers,
      COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN final_total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'UPI' THEN final_total ELSE 0 END), 0) as upi_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN final_total ELSE 0 END), 0) as card_sales,
      COALESCE(SUM(CASE WHEN payment_method NOT IN ('Cash', 'UPI', 'Card') THEN final_total ELSE 0 END), 0) as other_sales
    FROM orders
    WHERE order_date BETWEEN ? AND ? AND status = 'COMPLETED'
  `, [fromDate, toDate]);

  const orders = db.queryAll(`
    SELECT * FROM orders
    WHERE order_date BETWEEN ? AND ?
    ORDER BY id DESC
  `, [fromDate, toDate]);

  const topItems = db.queryAll(`
    SELECT 
      oi.item_name,
      oi.category_name,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.total_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.order_date BETWEEN ? AND ? AND o.status = 'COMPLETED'
    GROUP BY oi.item_name, oi.category_name
    ORDER BY total_quantity DESC
    LIMIT 15
  `, [fromDate, toDate]);

  return {
    summary: summary || {
      total_orders: 0,
      total_sales: 0,
      average_order_value: 0,
      unique_customers: 0,
      cash_sales: 0,
      upi_sales: 0,
      card_sales: 0,
      other_sales: 0
    },
    orders,
    topItems
  };
}

function getTopSellingItems(limit = 10) {
  return db.queryAll(`
    SELECT 
      oi.item_name,
      oi.category_name,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.total_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status = 'COMPLETED'
    GROUP BY oi.item_name, oi.category_name
    ORDER BY total_quantity DESC
    LIMIT ?
  `, [limit]);
}

// ==========================================
// 5. EXCEL DATASET EXTRACTOR
// ==========================================

function getFullExcelDataset() {
  const customers = getAllCustomers();
  const orders = db.queryAll("SELECT * FROM orders ORDER BY id DESC");
  const orderItems = db.queryAll("SELECT * FROM order_items ORDER BY id DESC");
  const menu = db.queryAll("SELECT * FROM menu_items ORDER BY category_name ASC, name ASC");
  const dailySales = getDailySales(365);
  const monthlySales = getMonthlySales();

  return {
    customers,
    orders,
    orderItems,
    menu,
    dailySales,
    monthlySales
  };
}

module.exports = {
  // Customers
  getCustomerById,
  getCustomerByPhone,
  searchCustomers,
  getAllCustomers,
  createOrUpdateCustomer,
  
  // Menu & Categories
  getAllCategories,
  getAllMenuItems,
  getMenuItemsByCategory,
  addMenuItem,
  updateMenuItem,
  toggleMenuItemStatus,
  deleteMenuItem,
  
  // Orders
  getNextOrderNumber,
  saveOrder,
  getOrderDetails,
  getOrdersByCustomer,
  getRecentOrders,
  cancelOrder,
  
  // Dashboard & Reports
  getDashboardSummary,
  getDailySales,
  getMonthlySales,
  getDateRangeReport,
  getTopSellingItems,
  
  // Excel Export
  getFullExcelDataset
};
