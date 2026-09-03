// Sree Sai Fillings Cafe - Expenses & Purchase List Controller

const ExpensesController = {
  allExpenses: [],

  init() {
    this.setupForm();
    this.setupFilters();
    this.setupExcelSync();
    this.setDefaultDate();
    this.loadExpenses();
    this.loadSummaries();
  },

  setDefaultDate() {
    const dateInput = document.getElementById('exp-input-date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }
  },

  setupForm() {
    const form = document.getElementById('form-add-expense');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('exp-input-name').value.trim();
      const cost = parseFloat(document.getElementById('exp-input-cost').value);
      const qty = document.getElementById('exp-input-qty').value.trim();
      const category = document.getElementById('exp-input-cat').value;
      const paymentMode = document.getElementById('exp-input-payment').value;
      const date = document.getElementById('exp-input-date').value || new Date().toISOString().split('T')[0];
      const vendor = document.getElementById('exp-input-vendor').value.trim();
      const notes = document.getElementById('exp-input-notes').value.trim();

      if (!name) {
        App.showToast('Please enter an item or expense name', 'warning');
        return;
      }

      if (isNaN(cost) || cost < 0) {
        App.showToast('Please enter a valid cost amount', 'warning');
        return;
      }

      const payload = {
        item_name: name,
        cost: cost,
        quantity: qty,
        category: category,
        payment_mode: paymentMode,
        expense_date: date,
        vendor: vendor,
        notes: notes
      };

      try {
        const btn = document.getElementById('btn-save-expense');
        if (btn) btn.disabled = true;

        const res = await window.electronAPI.addExpense(payload);
        if (res && res.id) {
          App.showToast(`Saved purchase: ${name} (₹${cost.toFixed(2)})`, 'success');
          // Reset form fields
          document.getElementById('exp-input-name').value = '';
          document.getElementById('exp-input-cost').value = '';
          document.getElementById('exp-input-qty').value = '';
          document.getElementById('exp-input-vendor').value = '';
          document.getElementById('exp-input-notes').value = '';
          this.setDefaultDate();
          
          // Reload
          await this.loadExpenses();
          await this.loadSummaries();

          // Refresh dashboard KPI if loaded
          if (window.DashboardController) {
            window.DashboardController.loadDashboard();
          }
        } else {
          App.showToast('Failed to save expense', 'error');
        }
      } catch (err) {
        App.showToast('Error saving expense: ' + err.message, 'error');
      } finally {
        const btn = document.getElementById('btn-save-expense');
        if (btn) btn.disabled = false;
      }
    });
  },

  setupFilters() {
    const searchInput = document.getElementById('exp-filter-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.applyFilters());
    }

    const catSelect = document.getElementById('exp-filter-cat');
    if (catSelect) {
      catSelect.addEventListener('change', () => this.applyFilters());
    }
  },

  setupExcelSync() {
    const btn = document.getElementById('btn-quick-sync-expenses-excel');
    if (btn) {
      btn.addEventListener('click', async () => {
        try {
          App.showToast('Syncing purchases to Excel...', 'info');
          const res = await window.electronAPI.syncExcel();
          if (res && res.success) {
            App.showToast('Excel synchronized with Sheet 7 (Purchases)!', 'success');
          } else {
            App.showToast(res ? res.message : 'Sync notice', 'warning');
          }
        } catch (e) {
          App.showToast('Excel sync error: ' + e.message, 'error');
        }
      });
    }
  },

  async loadExpenses() {
    try {
      this.allExpenses = await window.electronAPI.getAllExpenses({});
      this.renderTable(this.allExpenses);
    } catch (err) {
      console.error('Error loading expenses:', err);
    }
  },

  applyFilters() {
    const search = (document.getElementById('exp-filter-search')?.value || '').toLowerCase().trim();
    const category = document.getElementById('exp-filter-cat')?.value || 'ALL';

    const filtered = this.allExpenses.filter(e => {
      const matchSearch = !search || 
        (e.item_name && e.item_name.toLowerCase().includes(search)) ||
        (e.vendor && e.vendor.toLowerCase().includes(search)) ||
        (e.notes && e.notes.toLowerCase().includes(search));
      
      const matchCat = category === 'ALL' || e.category === category;
      return matchSearch && matchCat;
    });

    this.renderTable(filtered);
  },

  renderTable(expenses) {
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;

    if (!expenses || expenses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 36px 16px; color: var(--text-muted);">
            <div style="font-size: 24px; margin-bottom: 8px;">🛒</div>
            <div>No purchases or expenses found</div>
            <div style="font-size: 12px; margin-top: 4px; color: var(--text-tertiary);">Fill the form on the left to record cafe purchases</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = expenses.map(e => {
      const cost = parseFloat(e.cost) || 0;
      return `
        <tr>
          <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);">${this.formatDate(e.expense_date)}</td>
          <td style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(e.item_name)}</td>
          <td><span class="badge badge-neutral" style="font-size: 11px;">${this.escapeHtml(e.category || 'General')}</span></td>
          <td style="font-size: 12px; color: var(--text-secondary);">${this.escapeHtml(e.quantity || '-')}</td>
          <td style="font-weight: 700; color: #EF4444; font-family: var(--font-mono);">₹${cost.toFixed(2)}</td>
          <td><span class="badge ${e.payment_mode === 'Cash' ? 'badge-success' : 'badge-primary'}" style="font-size: 10px;">${e.payment_mode || 'Cash'}</span></td>
          <td style="font-size: 12px; color: var(--text-secondary);">${this.escapeHtml(e.vendor || '-')}</td>
          <td style="text-align: center;">
            <button class="btn btn-secondary btn-sm" style="padding: 4px 8px; color: #EF4444;" title="Delete Expense" onclick="ExpensesController.confirmDelete(${e.id}, '${this.escapeHtml(e.item_name)}')">
              <svg style="width: 14px; height: 14px;"><use href="#icon-trash"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async loadSummaries() {
    try {
      const [profit, exp] = await Promise.all([
        window.electronAPI.getProfitSummary(),
        window.electronAPI.getExpenseSummary()
      ]);

      // 1. Today's Purchases
      const todayCostEl = document.getElementById('exp-kpi-today-cost');
      if (todayCostEl) todayCostEl.textContent = `₹${(exp.todayTotal || 0).toFixed(2)}`;

      const todayCountEl = document.getElementById('exp-kpi-today-count');
      const todayDateStr = new Date().toISOString().split('T')[0];
      const todayItemsCount = this.allExpenses.filter(e => e.expense_date === todayDateStr).length;
      if (todayCountEl) todayCountEl.textContent = `${todayItemsCount} Purchases Today`;

      // 2. Month Purchases
      const monthCostEl = document.getElementById('exp-kpi-month-cost');
      if (monthCostEl) monthCostEl.textContent = `₹${(exp.monthTotal || 0).toFixed(2)}`;

      // 3. Today's Net Profit
      const todayProfitEl = document.getElementById('exp-kpi-today-profit');
      const todayMarginEl = document.getElementById('exp-kpi-today-margin');
      if (todayProfitEl && profit.today) {
        const p = profit.today.profit;
        todayProfitEl.textContent = (p >= 0 ? '₹' : '-₹') + Math.abs(p).toFixed(2);
        todayProfitEl.style.color = p >= 0 ? '#10B981' : '#EF4444';
        if (todayMarginEl) {
          todayMarginEl.textContent = `Sales: ₹${profit.today.sales.toFixed(2)} | Exp: ₹${profit.today.expense.toFixed(2)}`;
        }
      }

      // 4. Month Net Profit
      const monthProfitEl = document.getElementById('exp-kpi-month-profit');
      const monthMarginEl = document.getElementById('exp-kpi-month-margin');
      if (monthProfitEl && profit.month) {
        const p = profit.month.profit;
        monthProfitEl.textContent = (p >= 0 ? '₹' : '-₹') + Math.abs(p).toFixed(2);
        monthProfitEl.style.color = p >= 0 ? '#F59E0B' : '#EF4444';
        if (monthMarginEl) {
          monthMarginEl.textContent = `Sales: ₹${profit.month.sales.toFixed(2)} | Exp: ₹${profit.month.expense.toFixed(2)}`;
        }
      }

    } catch (err) {
      console.error('Error loading summaries:', err);
    }
  },

  async confirmDelete(id, name) {
    if (!confirm(`Are you sure you want to delete purchase "${name}"?`)) return;
    try {
      await window.electronAPI.deleteExpense(id);
      App.showToast(`Deleted "${name}"`, 'info');
      await this.loadExpenses();
      await this.loadSummaries();
      if (window.DashboardController) window.DashboardController.loadDashboard();
    } catch (err) {
      App.showToast('Error deleting expense: ' + err.message, 'error');
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.ExpensesController = ExpensesController;
