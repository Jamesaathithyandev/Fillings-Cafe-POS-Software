// Sree Sai Fillings Cafe - Supabase Cloud Synchronization Engine
// Handles offline-first background sync of Orders, Customers, and Menu

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabase = null;
let isConfigured = false;

// Load configuration
try {
  const configPath = path.join(__dirname, '../config/supabaseConfig.json');
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (cfg.supabaseUrl && (cfg.supabaseKey || cfg.supabaseAnonKey) && cfg.enabled) {
      supabase = createClient(cfg.supabaseUrl, cfg.supabaseKey || cfg.supabaseAnonKey, {
        auth: { persistSession: false }
      });
      isConfigured = true;
      console.log('Supabase Cloud Sync initialized successfully.');
    }
  }
} catch (e) {
  console.warn('Supabase config error:', e.message);
}

const SupabaseSync = {
  isReady() {
    return isConfigured && supabase !== null;
  },

  /**
   * Check connection health
   */
  async checkConnection() {
    if (!this.isReady()) return { connected: false, message: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.from('categories').select('id').limit(1);
      if (error && error.code === 'PGRST205') {
        return { connected: true, tablesReady: false, message: 'Connected, but tables need to be created in SQL Editor' };
      }
      if (error) {
        return { connected: false, tablesReady: false, message: error.message };
      }
      return { connected: true, tablesReady: true, message: 'Cloud Sync Online' };
    } catch (err) {
      return { connected: false, message: err.message };
    }
  },

  /**
   * Sync Customer to Supabase
   */
  async syncCustomer(customer) {
    if (!this.isReady()) return;
    try {
      const payload = {
        customer_code: customer.customer_code,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        address: customer.address || '',
        notes: customer.notes || '',
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('customers')
        .upsert(payload, { onConflict: 'phone' });

      if (error) console.warn('Supabase customer sync warning:', error.message);
      else console.log(`Synced customer ${customer.name} to Supabase`);
    } catch (err) {
      console.warn('Supabase customer sync exception (offline):', err.message);
    }
  },

  /**
   * Sync Order & Order Items to Supabase
   */
  async syncOrder(order, items = []) {
    if (!this.isReady()) return;
    try {
      // 1. Sync Customer First
      if (order.customer_name && order.customer_phone) {
        await this.syncCustomer({
          customer_code: order.customer_code || 'CUST-000000',
          name: order.customer_name,
          phone: order.customer_phone,
          address: order.customer_address,
          notes: order.customer_notes
        });
      }

      // 2. Insert Order
      const orderPayload = {
        order_number: order.order_number,
        customer_name: order.customer_name || 'Walk-in Customer',
        customer_phone: order.customer_phone || '',
        order_date: order.order_date,
        order_time: order.order_time,
        subtotal: parseFloat(order.subtotal) || 0,
        discount: parseFloat(order.discount) || 0,
        discount_type: order.discount_type || 'flat',
        final_total: parseFloat(order.final_total) || 0,
        payment_method: order.payment_method || 'Cash',
        order_type: order.order_type || 'Dine-In',
        packaging_charge: parseFloat(order.packaging_charge) || 0,
        status: order.status || 'COMPLETED',
        notes: order.notes || ''
      };

      const { data: insertedOrder, error: orderErr } = await supabase
        .from('orders')
        .upsert(orderPayload, { onConflict: 'order_number' })
        .select('id')
        .single();

      if (orderErr) {
        console.warn('Supabase order sync error:', orderErr.message);
        return;
      }

      // 3. Insert Order Items
      const orderId = insertedOrder ? insertedOrder.id : null;
      const orderItemsList = (items.length > 0 ? items : (order.items || [])).map(it => ({
        order_id: orderId,
        order_number: order.order_number,
        menu_item_id: it.menu_item_id || it.id || null,
        item_name: it.item_name || it.name,
        category_name: it.category_name || it.category || 'General',
        quantity: parseInt(it.quantity, 10) || 1,
        unit_price: parseFloat(it.unit_price || it.price) || 0,
        total_price: parseFloat(it.total_price || it.total) || 0
      }));

      if (orderItemsList.length > 0) {
        const { error: itemsErr } = await supabase
          .from('order_items')
          .insert(orderItemsList);

        if (itemsErr) console.warn('Supabase items sync error:', itemsErr.message);
      }

      console.log(`Order ${order.order_number} synced to Supabase successfully`);
    } catch (err) {
      console.warn('Supabase order sync exception (offline):', err.message);
    }
  },

  /**
   * Sync Menu Categories & Items to Supabase
   */
  async syncMenu(categories = [], menuItems = []) {
    if (!this.isReady()) return;
    try {
      if (categories.length > 0) {
        const catRows = categories.map(c => ({
          name: c.name,
          display_order: c.display_order || 0
        }));
        await supabase.from('categories').upsert(catRows, { onConflict: 'name' });
      }

      if (menuItems.length > 0) {
        const itemRows = menuItems.map(m => ({
          category_name: m.category_name || m.category,
          name: m.name,
          description: m.description || '',
          price: parseFloat(m.price) || 0,
          is_active: m.is_active !== undefined ? Boolean(m.is_active) : true
        }));
        await supabase.from('menu_items').upsert(itemRows, { onConflict: 'name' });
      }
      console.log('Menu successfully synced to Supabase');
    } catch (err) {
      console.warn('Supabase menu sync error:', err.message);
    }
  }
};

module.exports = SupabaseSync;
