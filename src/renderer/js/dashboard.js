// Sree Sai Fillings Cafe — Dashboard Controller v2.0

const DashboardController = {
  init() {
    this.refresh();
  },

  async refresh() {
    await Promise.all([
      this.loadSummaryKPIs(),
      this.loadRecentOrders(),
      this.loadTopSellingItems()
    ]);
  },

  async loadSummaryKPIs() {
    try {
      const summary = await window.electronAPI.getDashboardSummary();

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

      set('kpi-today-sales',     App.formatCurrency(summary.today.sales));
      set('kpi-today-orders',    `${summary.today.orders} Orders Today`);
      set('kpi-month-sales',     App.formatCurrency(summary.month.sales));
      set('kpi-month-orders',    `${summary.month.orders} Orders This Month`);
      set('kpi-total-customers', (summary.totals.customers || 0).toLocaleString());
      set('kpi-aov',             App.formatCurrency(summary.totals.averageOrderValue));
      set('kpi-total-orders-all',`Across ${summary.totals.orders} Total Orders`);

    } catch (e) {
      console.warn('Dashboard KPI load error:', e);
    }
  },

  async loadRecentOrders() {
    const list = document.getElementById('dashboard-recent-orders-body');
    if (!list) return;

    try {
      const orders = await window.electronAPI.getRecentOrders(10);

      if (orders.length === 0) {
        list.innerHTML = `
          <div class="cart-empty" style="padding:32px 20px;">
            <svg viewBox="0 0 120 100"><use href="#illus-no-data"/></svg>
            <div class="cart-empty-title">No orders yet</div>
            <div class="cart-empty-sub">Click "Add Order" to place your first bill!</div>
          </div>
        `;
        return;
      }

      list.innerHTML = orders.map(o => {
        const initials = (o.customer_name || '?').charAt(0).toUpperCase();
        const statusClass = o.status === 'Completed' ? 'badge-success' : o.status === 'Cancelled' ? 'badge-danger' : 'badge-warning';
        const payBadge = { Cash: 'badge-success', UPI: 'badge-info', Card: 'badge-info', Other: 'badge-warning' }[o.payment_method] || 'badge-info';

        return `
          <div class="order-row">
            <div class="order-row-num">${o.order_number}</div>
            <div class="order-row-cust">
              <div class="order-row-name">${o.customer_name || 'Walk-in'}</div>
              <div class="order-row-phone">${o.customer_phone || '—'}</div>
            </div>
            <div class="order-row-amount">${App.formatCurrency(o.final_total)}</div>
            <div class="order-row-meta">
              <span class="badge ${payBadge}" style="font-size:10px;">${o.payment_method}</span>
              <div class="order-row-time">${o.order_date} ${o.order_time ? o.order_time.slice(0,5) : ''}</div>
            </div>
            <div class="order-row-actions">
              <button class="row-action-btn btn-view-order-dash" title="View Bill" data-ord="${o.order_number}">
                <svg><use href="#icon-view"/></svg>
              </button>
              <button class="row-action-btn btn-print-order-dash" title="Re-Print" data-ord="${o.order_number}">
                <svg><use href="#icon-print"/></svg>
              </button>
            </div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.btn-view-order-dash, .btn-print-order-dash').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ordNum = btn.getAttribute('data-ord');
          const details = await window.electronAPI.getOrderDetails(ordNum);
          if (details && window.ReceiptController) {
            window.ReceiptController.showReceipt(details);
          }
        });
      });

    } catch (e) {
      console.warn('Recent orders error:', e);
    }
  },

  async loadTopSellingItems() {
    const list = document.getElementById('dashboard-top-items-list');
    if (!list) return;

    try {
      const items = await window.electronAPI.getTopSellingItems(7);

      if (items.length === 0) {
        list.innerHTML = `
          <div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12.5px;">
            Top selling items appear here as orders are saved.
          </div>
        `;
        return;
      }

      const maxQty = items[0].total_quantity || 1;

      const rankClasses = ['gold', 'silver', 'bronze'];

      list.innerHTML = items.map((item, idx) => `
        <div class="top-item-row">
          <div class="top-rank ${rankClasses[idx] || ''}">${idx + 1}</div>
          <div class="top-item-info">
            <div class="top-item-name">${item.item_name}</div>
            <div class="top-item-cat">${item.category_name}</div>
          </div>
          <div class="top-item-bar-wrap">
            <div class="top-item-bar" style="width:${Math.round((item.total_quantity / maxQty) * 100)}%"></div>
          </div>
          <div class="top-item-count">${item.total_quantity}</div>
        </div>
      `).join('');

    } catch (e) {
      console.warn('Top items error:', e);
    }
  }
};

window.DashboardController = DashboardController;
document.addEventListener('DOMContentLoaded', () => {
  DashboardController.init();
});
