// Sree Sai Fillings Cafe - Sales & Reports Controller

const ReportsController = {
  activeTab: 'daily', // 'daily', 'monthly', 'custom'
  dailyData: [],
  monthlyData: [],
  customData: null,

  init() {
    this.bindEvents();
    this.setDefaultDates();
  },

  async refresh() {
    if (this.activeTab === 'daily') await this.loadDailySales();
    else if (this.activeTab === 'monthly') await this.loadMonthlySales();
    else if (this.activeTab === 'custom') await this.loadCustomReport();
  },

  setDefaultDates() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    
    // Default 30 days ago
    const past = new Date();
    past.setDate(past.getDate() - 30);
    const pastDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;

    const fromInput = document.getElementById('report-from-date');
    const toInput = document.getElementById('report-to-date');

    if (fromInput) fromInput.value = pastDate;
    if (toInput) toInput.value = today;
  },

  bindEvents() {
    const tabs = document.querySelectorAll('.report-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = tab.getAttribute('data-report');

        const filterBox = document.getElementById('reports-date-filter');
        if (filterBox) {
          filterBox.style.display = this.activeTab === 'custom' ? 'flex' : 'none';
        }

        this.refresh();
      });
    });

    const btnRunCustom = document.getElementById('btn-run-custom-report');
    if (btnRunCustom) {
      btnRunCustom.addEventListener('click', () => this.loadCustomReport());
    }

    const btnExport = document.getElementById('btn-export-reports-excel');
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        App.showToast('Exporting Sales Report to Excel...', 'info');
        const res = await window.electronAPI.exportExcelDialog();
        if (res.success) {
          App.showToast('Report exported successfully!', 'success');
        } else if (res.message) {
          App.showToast(res.message, 'warning');
        }
      });
    }
  },

  async loadDailySales() {
    try {
      this.dailyData = await window.electronAPI.getDailySales(60);
      
      // Update Payment Totals
      let cash = 0, upi = 0, card = 0, total = 0;
      this.dailyData.forEach(d => {
        cash += d.cash_sales;
        upi += d.upi_sales;
        card += d.card_sales;
        total += d.total_sales;
      });

      this.updateKpis(cash, upi, card, total);

      // Render Table
      const head = document.getElementById('reports-table-head');
      const body = document.getElementById('reports-table-body');
      const title = document.getElementById('reports-table-title');

      if (title) title.textContent = 'Daily Sales Records';
      if (head) {
        head.innerHTML = `
          <tr>
            <th>Date</th>
            <th style="text-align:right;">Orders</th>
            <th style="text-align:right;">Total Sales (₹)</th>
            <th style="text-align:right;">Cash (₹)</th>
            <th style="text-align:right;">UPI (₹)</th>
            <th style="text-align:right;">Card (₹)</th>
            <th style="text-align:right;">Other (₹)</th>
            <th style="text-align:right;">Avg Order (₹)</th>
          </tr>
        `;
      }

      if (body) {
        if (this.dailyData.length === 0) {
          body.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No sales recorded yet.</td></tr>`;
          return;
        }

        body.innerHTML = this.dailyData.map(d => `
          <tr>
            <td><strong style="color:var(--text-amber);">${App.formatDate(d.date)}</strong></td>
            <td style="text-align:right;">${d.number_of_orders}</td>
            <td style="text-align:right;"><strong style="color:var(--primary);">${App.formatCurrency(d.total_sales)}</strong></td>
            <td style="text-align:right;">${App.formatCurrency(d.cash_sales)}</td>
            <td style="text-align:right;">${App.formatCurrency(d.upi_sales)}</td>
            <td style="text-align:right;">${App.formatCurrency(d.card_sales)}</td>
            <td style="text-align:right;">${App.formatCurrency(d.other_sales)}</td>
            <td style="text-align:right;">${App.formatCurrency(d.average_order_value)}</td>
          </tr>
        `).join('');
      }

    } catch (e) {
      console.warn('Daily sales error:', e);
    }
  },

  async loadMonthlySales() {
    try {
      this.monthlyData = await window.electronAPI.getMonthlySales();

      let cash = 0, upi = 0, card = 0, total = 0;
      this.monthlyData.forEach(m => {
        cash += m.cash_sales;
        upi += m.upi_sales;
        card += m.card_sales;
        total += m.total_sales;
      });

      this.updateKpis(cash, upi, card, total);

      const head = document.getElementById('reports-table-head');
      const body = document.getElementById('reports-table-body');
      const title = document.getElementById('reports-table-title');

      if (title) title.textContent = 'Monthly Sales Records';
      if (head) {
        head.innerHTML = `
          <tr>
            <th>Month</th>
            <th style="text-align:right;">Orders</th>
            <th style="text-align:right;">Total Sales (₹)</th>
            <th style="text-align:right;">Cash (₹)</th>
            <th style="text-align:right;">UPI (₹)</th>
            <th style="text-align:right;">Card (₹)</th>
            <th style="text-align:right;">Other (₹)</th>
            <th style="text-align:right;">Avg Order (₹)</th>
          </tr>
        `;
      }

      if (body) {
        if (this.monthlyData.length === 0) {
          body.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No monthly data yet.</td></tr>`;
          return;
        }

        body.innerHTML = this.monthlyData.map(m => `
          <tr>
            <td><strong style="color:var(--text-amber);">${m.month}</strong></td>
            <td style="text-align:right;">${m.number_of_orders}</td>
            <td style="text-align:right;"><strong style="color:var(--primary);">${App.formatCurrency(m.total_sales)}</strong></td>
            <td style="text-align:right;">${App.formatCurrency(m.cash_sales)}</td>
            <td style="text-align:right;">${App.formatCurrency(m.upi_sales)}</td>
            <td style="text-align:right;">${App.formatCurrency(m.card_sales)}</td>
            <td style="text-align:right;">${App.formatCurrency(m.other_sales)}</td>
            <td style="text-align:right;">${App.formatCurrency(m.average_order_value)}</td>
          </tr>
        `).join('');
      }

    } catch (e) {
      console.warn('Monthly sales error:', e);
    }
  },

  async loadCustomReport() {
    const fromInput = document.getElementById('report-from-date');
    const toInput = document.getElementById('report-to-date');

    const fromDate = fromInput ? fromInput.value : '';
    const toDate = toInput ? toInput.value : '';

    if (!fromDate || !toDate) {
      App.showToast('Please select From and To dates.', 'warning');
      return;
    }

    try {
      this.customData = await window.electronAPI.getDateRangeReport(fromDate, toDate);
      const s = this.customData.summary;

      this.updateKpis(s.cash_sales, s.upi_sales, s.card_sales, s.total_sales);

      const head = document.getElementById('reports-table-head');
      const body = document.getElementById('reports-table-body');
      const title = document.getElementById('reports-table-title');

      if (title) title.textContent = `Custom Analysis: ${fromDate} to ${toDate} (${s.total_orders} Orders, ${s.unique_customers} Unique Customers)`;
      if (head) {
        head.innerHTML = `
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Date & Time</th>
            <th>Subtotal</th>
            <th>Discount</th>
            <th>Final Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th style="text-align:center;">Actions</th>
          </tr>
        `;
      }

      if (body) {
        if (this.customData.orders.length === 0) {
          body.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">No orders found within this date range.</td></tr>`;
          return;
        }

        body.innerHTML = this.customData.orders.map(o => `
          <tr>
            <td><strong style="color:var(--text-amber);">${o.order_number}</strong></td>
            <td><strong>${o.customer_name}</strong></td>
            <td>${o.customer_phone || '—'}</td>
            <td>${o.order_date} ${o.order_time ? o.order_time.slice(0,5) : ''}</td>
            <td>${App.formatCurrency(o.subtotal)}</td>
            <td>${App.formatCurrency(o.discount)}</td>
            <td><strong style="color:var(--primary);">${App.formatCurrency(o.final_total)}</strong></td>
            <td><span style="background:var(--bg-input); padding:3px 8px; border-radius:4px; font-size:11px;">${o.payment_method}</span></td>
            <td><span class="badge ${o.status === 'Completed' ? 'badge-success' : o.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}">${o.status}</span></td>
            <td style="text-align:center;">
              <div style="display:flex; justify-content:center; gap:6px;">
                <button class="row-action-btn btn-view-report-order" data-ord="${o.order_number}" title="View Order / Print Bill" style="padding:4px 6px;">
                  <svg style="width:14px; height:14px;"><use href="#icon-view"/></svg>
                </button>
                <button class="row-action-btn btn-delete-report-order" data-ord="${o.order_number}" title="Delete Order" style="padding:4px 6px; color:var(--rose-400);">
                  <svg style="width:14px; height:14px;"><use href="#icon-trash"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `).join('');

        body.querySelectorAll('.btn-view-report-order').forEach(btn => {
          btn.addEventListener('click', async () => {
            const ordNum = btn.getAttribute('data-ord');
            const details = await window.electronAPI.getOrderDetails(ordNum);
            if (details && window.ReceiptController) {
              window.ReceiptController.showReceipt(details);
            }
          });
        });

        body.querySelectorAll('.btn-delete-report-order').forEach(btn => {
          btn.addEventListener('click', async () => {
            const ordNum = btn.getAttribute('data-ord');
            if (!ordNum) return;
            const confirmed = confirm(`⚠️ Are you sure you want to permanently delete order #${ordNum}?\n\nThis will remove it from the database, cloud sync, and Excel report.`);
            if (!confirmed) return;

            try {
              if (window.electronAPI && window.electronAPI.deleteOrder) {
                const res = await window.electronAPI.deleteOrder(ordNum);
                if (res && res.success) {
                  if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast(`🗑️ Order #${ordNum} deleted successfully`, 'success');
                  }
                  ReportsController.loadCustomReport();
                  if (typeof DashboardController !== 'undefined' && DashboardController.refresh) {
                    DashboardController.refresh();
                  }
                  if (typeof POSController !== 'undefined' && POSController.loadOpenOrders) {
                    POSController.loadOpenOrders();
                  }
                } else {
                  alert(`Failed to delete order: ${res ? res.error : 'Unknown error'}`);
                }
              }
            } catch (err) {
              console.error('Delete order error:', err);
              alert(`Error deleting order: ${err.message}`);
            }
          });
        });
      }

    } catch (e) {
      console.warn('Custom report error:', e);
    }
  },

  updateKpis(cash, upi, card, total) {
    const cashEl = document.getElementById('rep-cash-val');
    const upiEl = document.getElementById('rep-upi-val');
    const cardEl = document.getElementById('rep-card-val');
    const totalEl = document.getElementById('rep-total-val');

    if (cashEl) cashEl.textContent = App.formatCurrency(cash);
    if (upiEl) upiEl.textContent = App.formatCurrency(upi);
    if (cardEl) cardEl.textContent = App.formatCurrency(card);
    if (totalEl) totalEl.textContent = App.formatCurrency(total);
  }
};

window.ReportsController = ReportsController;
document.addEventListener('DOMContentLoaded', () => {
  ReportsController.init();
});
