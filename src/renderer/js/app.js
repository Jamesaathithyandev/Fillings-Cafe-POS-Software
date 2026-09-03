// Sree Sai Fillings Cafe - App Controller & Navigation

const App = {
  activeView: 'dashboard',
  
  init() {
    this.setupNavigation();
    this.setupClock();
    this.setupShortcuts();
    this.setupSystemButtons();
    this.checkExcelStatus();
    
    // Auto sync check every 30s
    setInterval(() => this.checkExcelStatus(), 30000);
  },

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Dashboard shortcut buttons
    const btnDashAddOrder = document.getElementById('btn-dash-add-order');
    if (btnDashAddOrder) btnDashAddOrder.addEventListener('click', () => this.switchView('pos'));

    const btnDashSearchCust = document.getElementById('btn-dash-search-cust');
    if (btnDashSearchCust) btnDashSearchCust.addEventListener('click', () => this.switchView('customers'));

    const btnDashViewAllOrders = document.getElementById('btn-dash-view-all-orders');
    if (btnDashViewAllOrders) btnDashViewAllOrders.addEventListener('click', () => this.switchView('reports'));
  },

  switchView(viewName) {
    this.activeView = viewName;

    // Update Nav active classes
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update View Containers
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Update Heading
    const heading = document.getElementById('page-heading');
    const titles = {
      dashboard: 'Main Dashboard',
      pos: 'Add Order / Billing POS',
      customers: 'Customer Database & History',
      menu: 'Menu Management',
      reports: 'Sales & Business Reports',
      backup: 'Excel Synchronization & Backups'
    };
    if (heading) heading.textContent = titles[viewName] || 'Sree Sai Fillings Cafe';

    // Trigger View Lifecycle Hooks
    if (viewName === 'dashboard' && window.DashboardController) window.DashboardController.refresh();
    if (viewName === 'pos' && window.POSController) window.POSController.onEnter();
    if (viewName === 'customers' && window.CustomersController) window.CustomersController.refresh();
    if (viewName === 'menu' && window.MenuController) window.MenuController.refresh();
    if (viewName === 'reports' && window.ReportsController) window.ReportsController.refresh();
    if (viewName === 'backup' && window.BackupController) window.BackupController.refresh();
  },

  setupClock() {
    const clockEl = document.getElementById('live-clock');
    const update = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      if (clockEl) clockEl.innerHTML = `🕒 ${dateStr} • ${timeStr}`;
    };
    update();
    setInterval(update, 1000);
  },

  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      // F1: Add Order
      if (e.key === 'F1') {
        e.preventDefault();
        this.switchView('pos');
      }
      // F2: Customer Database / Search Customer
      else if (e.key === 'F2') {
        e.preventDefault();
        this.switchView('customers');
        const input = document.getElementById('cust-search-input');
        if (input) input.focus();
      }
      // F9: Save & Print Bill (in POS)
      else if (e.key === 'F9') {
        e.preventDefault();
        if (this.activeView === 'pos' && window.POSController) {
          window.POSController.handleSaveOrder(true);
        }
      }
      // F10: Save Order Only (in POS)
      else if (e.key === 'F10') {
        e.preventDefault();
        if (this.activeView === 'pos' && window.POSController) {
          window.POSController.handleSaveOrder(false);
        }
      }
    });
  },

  setupSystemButtons() {
    const btnOpenExcel = document.getElementById('btn-open-excel');
    if (btnOpenExcel) {
      btnOpenExcel.addEventListener('click', async () => {
        try {
          await window.electronAPI.openExcelFile();
        } catch (e) {
          App.showToast('Could not open Excel file.', 'warning');
        }
      });
    }

    const btnOpenDataDir = document.getElementById('btn-open-data-dir');
    if (btnOpenDataDir) {
      btnOpenDataDir.addEventListener('click', async () => {
        try {
          await window.electronAPI.openDataFolder();
        } catch (e) {
          App.showToast('Could not open data folder.', 'warning');
        }
      });
    }

    const btnQuickSync = document.getElementById('btn-quick-sync');
    if (btnQuickSync) {
      btnQuickSync.addEventListener('click', async () => {
        App.showToast('Synchronizing Excel...', 'info');
        const res = await window.electronAPI.syncExcel();
        if (res.success) {
          App.showToast('Excel workbook synchronized successfully!', 'success');
        } else {
          App.showToast(res.message, 'warning');
        }
        App.checkExcelStatus();
      });
    }
  },

  async checkExcelStatus() {
    try {
      const status = await window.electronAPI.getExcelStatus();
      const dot = document.getElementById('sync-dot');
      const text = document.getElementById('sync-text');
      if (dot && text) {
        if (status.locked) {
          dot.className = 'status-dot warning';
          text.textContent = 'Excel Open (Locked)';
        } else if (status.success) {
          dot.className = 'status-dot';
          text.textContent = 'Excel Synced';
        } else {
          dot.className = 'status-dot warning';
          text.textContent = 'Sync Pending';
        }
      }
    } catch (e) {
      console.warn('Sync status check error:', e);
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  },

  // Formatting Utilities
  formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatDate(dateStr) {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
      const [y, m, d] = dateStr.split('-');
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
