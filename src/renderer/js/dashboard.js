// Sree Sai Fillings Cafe - Main Dashboard Controller

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
      
      const todaySalesEl = document.getElementById('kpi-today-sales');
      const todayOrdersEl = document.getElementById('kpi-today-orders');
      const monthSalesEl = document.getElementById('kpi-month-sales');
      const monthOrdersEl = document.getElementById('kpi-month-orders');
      const totalCustEl = document.getElementById('kpi-total-customers');
      const aovEl = document.getElementById('kpi-aov');
      const totalOrdersAllEl = document.getElementById('kpi-total-orders-all');

      if (todaySalesEl) todaySalesEl.textContent = App.formatCurrency(summary.today.sales);
      if (todayOrdersEl) todayOrdersEl.textContent = `${summary.today.orders} Orders Today`;

      if (monthSalesEl) monthSalesEl.textContent = App.formatCurrency(summary.month.sales);
      if (monthOrdersEl) monthOrdersEl.textContent = `${summary.month.orders} Orders This Month`;

      if (totalCustEl) totalCustEl.textContent = (summary.totals.customers || 0).toLocaleString();
      if (aovEl) aovEl.textContent = App.formatCurrency(summary.totals.averageOrderValue);
      if (totalOrdersAllEl) totalOrdersAllEl.textContent = `Across ${summary.totals.orders} Total Orders`;

    } catch (e) {
      console.warn('Dashboard KPI load error:', e);
    }
  },

  async loadRecentOrders() {
    const tbody = document.getElementById('dashboard-recent-orders-body');
    if (!tbody) return;

    try {
      const orders = await window.electronAPI.getRecentOrders(10);
      if (orders.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">
              No orders placed yet. Click "+ ADD ORDER" to make your first bill!
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = orders.map(o => `
        <tr>
          <td><strong style="color:var(--text-amber);">${o.order_number}</strong></td>
          <td><strong>${o.customer_name}</strong></td>
          <td>${o.customer_phone}</td>
          <td>${o.order_date} ${o.order_time}</td>
          <td><strong style="color:var(--primary);">${App.formatCurrency(o.final_total)}</strong></td>
          <td><span style="background:var(--bg-input); padding:3px 8px; border-radius:4px; font-size:11px;">${o.payment_method}</span></td>
          <td><span class="status-badge ${o.status.toLowerCase()}">${o.status}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm btn-view-order-dash" data-ord="${o.order_number}">View Bill</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-view-order-dash').forEach(btn => {
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
      const items = await window.electronAPI.getTopSellingItems(6);
      if (items.length === 0) {
        list.innerHTML = `
          <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">
            Top selling items will appear here as orders are saved.
          </div>
        `;
        return;
      }

      list.innerHTML = items.map((item, idx) => `
        <div class="top-item-row">
          <span class="top-item-rank">#${idx + 1}</span>
          <div class="top-item-name">
            <div>${item.item_name}</div>
            <div style="font-size:10px; color:var(--text-muted); font-weight:normal;">${item.category_name}</div>
          </div>
          <span class="top-item-qty">${item.total_quantity} sold</span>
          <span class="top-item-rev">${App.formatCurrency(item.total_revenue)}</span>
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
