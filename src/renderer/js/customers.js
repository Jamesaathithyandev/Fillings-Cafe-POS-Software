// Sree Sai Fillings Cafe - Customers Management Controller

const CustomersController = {
  allCustomers: [],
  activeSegment: 'all',
  searchQuery: '',

  init() {
    this.bindEvents();
  },

  async refresh() {
    await this.loadCustomers();
  },

  bindEvents() {
    const searchInput = document.getElementById('cust-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderTable();
      });
    }

    const filterChips = document.querySelectorAll('.seg-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeSegment = chip.getAttribute('data-segment') || 'all';
        this.renderTable();
      });
    });

    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', () => this.closeDrawer());
    }

    const btnExportExcel = document.getElementById('btn-export-customers-excel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', async () => {
        App.showToast('Exporting Customer Database to Excel...', 'info');
        const res = await window.electronAPI.exportExcelDialog();
        if (res.success) {
          App.showToast('Customers exported successfully!', 'success');
        } else if (res.message) {
          App.showToast(res.message, 'warning');
        }
      });
    }
  },

  async loadCustomers() {
    try {
      this.allCustomers = await window.electronAPI.getAllCustomers();
      this.renderTable();
    } catch (e) {
      console.warn('Customer load error:', e);
      App.showToast('Failed to load customers', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;

    let list = this.allCustomers;

    // Segment Filter
    if (this.activeSegment === 'high') {
      list = list.filter(c => (c.total_spent || 0) >= 2000);
    } else if (this.activeSegment === 'frequent') {
      list = list.filter(c => (c.total_orders || 0) >= 3);
    } else if (this.activeSegment === 'recent') {
      const now = new Date();
      list = list.filter(c => c.last_order_date && c.last_order_date !== 'N/A');
    }

    // Search Query Filter
    if (this.searchQuery) {
      list = list.filter(c => 
        (c.name && c.name.toLowerCase().includes(this.searchQuery)) ||
        (c.phone && c.phone.toLowerCase().includes(this.searchQuery)) ||
        (c.email && c.email.toLowerCase().includes(this.searchQuery)) ||
        (c.customer_code && c.customer_code.toLowerCase().includes(this.searchQuery))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);">
            No customers found matching the criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(c => {
      const initials = (c.name || '?').charAt(0).toUpperCase();
      const spent = parseFloat(c.total_spent || 0);
      const tierClass = spent >= 5000 ? 'gold' : spent >= 2000 ? 'silver' : 'regular';
      const tierLabel = spent >= 5000 ? '★ Gold' : spent >= 2000 ? '◆ Silver' : 'Regular';

      return `
        <tr class="customer-row" data-id="${c.id}" style="cursor:pointer;">
          <td>
            <div class="cust-cell-name">
              <div class="cust-avatar">${initials}</div>
              <div>
                <div class="cust-name-text">${c.name}</div>
                <div class="cust-code-text">${c.customer_code || ('CUST-' + c.id)}</div>
              </div>
            </div>
          </td>
          <td>${c.phone}</td>
          <td>${c.email || '—'}</td>
          <td style="max-width:150px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.address || '—'}</td>
          <td style="text-align:center; font-family:var(--font-mono); font-weight:700;">${c.total_orders || 0}</td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-family:var(--font-mono); color:var(--text-primary);">${App.formatCurrency(c.total_spent || 0)}</strong>
              <span class="spend-tier ${tierClass}">${tierLabel}</span>
            </div>
          </td>
          <td style="color:var(--text-muted); font-size:12px;">${App.formatDate(c.last_order_date)}</td>
          <td>
            <div class="table-action-btns">
              <button class="tbl-btn edit btn-view-cust-drawer" data-id="${c.id}" title="View history">
                <svg><use href="#icon-view"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.customer-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        this.openDrawer(id);
      });
    });
  },

  async openDrawer(customerId) {
    try {
      const customer = await window.electronAPI.getCustomerById(customerId);
      const orders = await window.electronAPI.getCustomerOrders(customerId);
      if (!customer) return;

      const nameEl = document.getElementById('drawer-cust-name');
      const codeEl = document.getElementById('drawer-cust-code');
      const phoneEl = document.getElementById('drawer-cust-phone');
      const emailEl = document.getElementById('drawer-cust-email');
      const addrEl = document.getElementById('drawer-cust-address');
      const notesEl = document.getElementById('drawer-cust-notes');

      const spentEl = document.getElementById('drawer-total-spent');
      const ordersEl = document.getElementById('drawer-total-orders');
      const lastOrdEl = document.getElementById('drawer-last-order');

      if (nameEl) nameEl.textContent = customer.name;
      if (codeEl) codeEl.textContent = customer.customer_code || `CUST-${customer.id}`;
      if (phoneEl) phoneEl.textContent = customer.phone;
      if (emailEl) emailEl.textContent = customer.email || '—';
      if (addrEl) addrEl.textContent = customer.address || '—';
      if (notesEl) notesEl.textContent = customer.notes || '—';

      if (spentEl) spentEl.textContent = App.formatCurrency(customer.total_spent || 0);
      if (ordersEl) ordersEl.textContent = customer.total_orders || 0;
      if (lastOrdEl) lastOrdEl.textContent = App.formatDate(customer.last_order_date);

      // Avatar & phone in header
      const avatarEl = document.getElementById('drawer-cust-avatar');
      const phoneDEl = document.getElementById('drawer-cust-phone-display');
      if (avatarEl) avatarEl.textContent = (customer.name || '?').charAt(0).toUpperCase();
      if (phoneDEl) phoneDEl.textContent = customer.phone || '—';

      // Render Order History Cards
      const ordersList = document.getElementById('drawer-orders-list');
      if (ordersList) {
        if (!orders || orders.length === 0) {
          ordersList.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">
              No order history available for this customer.
            </div>
          `;
        } else {
          ordersList.innerHTML = orders.map(o => `
            <div class="order-hist-card" data-ord="${o.order_number}">
              <div class="ohc-top">
                <div class="ohc-num">${o.order_number}</div>
                <div class="ohc-amount">${App.formatCurrency(o.final_total)}</div>
              </div>
              <div class="ohc-items">${o.items_summary || 'Items not available'}</div>
              <div class="ohc-bottom">
                <div class="ohc-date">${o.order_date} ${o.order_time ? o.order_time.slice(0,5) : ''} &bull; ${o.payment_method}</div>
                <span class="badge ${o.status === 'Completed' ? 'badge-success' : o.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}">${o.status}</span>
              </div>
            </div>
          `).join('');

          ordersList.querySelectorAll('.order-hist-card').forEach(card => {
            card.addEventListener('click', async () => {
              const ordNum = card.getAttribute('data-ord');
              const details = await window.electronAPI.getOrderDetails(ordNum);
              if (details && window.ReceiptController) {
                window.ReceiptController.showReceipt(details);
              }
            });
          });
        }
      }

      const drawer = document.getElementById('customer-history-drawer');
      if (drawer) drawer.classList.add('open');

    } catch (e) {
      console.warn('Customer drawer error:', e);
    }
  },

  closeDrawer() {
    const drawer = document.getElementById('customer-history-drawer');
    if (drawer) drawer.classList.remove('open');
  }
};

window.CustomersController = CustomersController;
document.addEventListener('DOMContentLoaded', () => {
  CustomersController.init();
});
