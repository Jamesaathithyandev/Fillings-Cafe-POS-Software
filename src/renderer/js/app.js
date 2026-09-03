// Sree Sai Fillings Cafe - App Controller & Navigation

const App = {
  activeView: 'dashboard',
  
  async init() {
    this.setupAuth();
    this.setupNavigation();
    this.setupClock();
    this.setupShortcuts();
    this.setupSystemButtons();
    this.checkExcelStatus();
    this.checkCloudStatus();
    
    // Auto sync check every 30s
    setInterval(() => {
      this.checkExcelStatus();
      this.checkCloudStatus();
    }, 30000);

    // Verify session
    await this.checkAuthSession();
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
      dashboard: 'Dashboard',
      pos: 'Add Order',
      customers: 'Customer Database',
      menu: 'Menu Manager',
      reports: 'Sales & Reports',
      backup: 'Excel & Backup'
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
    const greetEl = document.getElementById('hero-greeting');
    const update = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      if (clockEl) clockEl.innerHTML = `<svg><use href="#icon-clock"/></svg>${dateStr} &bull; ${timeStr}`;
      if (greetEl) {
        const h = now.getHours();
        greetEl.textContent = h < 12 ? 'Good Morning ☀️' : h < 17 ? 'Good Afternoon 🌤️' : 'Good Evening 🌙';
      }
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

  setupAuth() {
    const formLogin = document.getElementById('form-login');
    const inputUser = document.getElementById('login-username');
    const inputPass = document.getElementById('login-password');
    const chkRemember = document.getElementById('login-remember');
    const btnTogglePwd = document.getElementById('btn-toggle-pwd');
    const errorMsg = document.getElementById('login-error-msg');
    const btnSubmit = document.getElementById('btn-login-submit');
    const btnLock = document.getElementById('btn-lock-screen');
    const btnCloudPull = document.getElementById('btn-cloud-pull');

    // Toggle password visibility
    if (btnTogglePwd && inputPass) {
      btnTogglePwd.addEventListener('click', () => {
        const isPass = inputPass.type === 'password';
        inputPass.type = isPass ? 'text' : 'password';
      });
    }

    // Submit login form
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = inputUser.value.trim();
        const password = inputPass.value;
        const remember = chkRemember ? chkRemember.checked : true;

        if (!username || !password) {
          if (errorMsg) {
            errorMsg.textContent = 'Please enter both username and password.';
            errorMsg.style.display = 'block';
          }
          return;
        }

        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.style.opacity = '0.7';
          const txt = document.getElementById('btn-login-text');
          if (txt) txt.textContent = 'Verifying...';
        }
        if (errorMsg) errorMsg.style.display = 'none';

        try {
          const res = await window.electronAPI.login(username, password, remember);
          if (res && res.success) {
            this.unlockApp(res.user);
            App.showToast(`Welcome back, ${res.user.displayName || res.user.username}!`, 'success');
            // Pull latest cloud data
            this.triggerCloudPull(false);
          } else {
            if (errorMsg) {
              errorMsg.textContent = res ? res.message : 'Invalid credentials.';
              errorMsg.style.display = 'block';
            }
          }
        } catch (err) {
          if (errorMsg) {
            errorMsg.textContent = 'Login error: ' + err.message;
            errorMsg.style.display = 'block';
          }
        } finally {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
            const txt = document.getElementById('btn-login-text');
            if (txt) txt.textContent = 'Sign In & Open POS';
          }
        }
      });
    }

    // Lock screen button
    if (btnLock) {
      btnLock.addEventListener('click', async () => {
        await window.electronAPI.logout();
        this.lockApp();
        App.showToast('POS locked successfully.', 'info');
      });
    }

    // Cloud Pull button
    if (btnCloudPull) {
      btnCloudPull.addEventListener('click', () => {
        this.triggerCloudPull(true);
      });
    }
  },

  async checkAuthSession() {
    try {
      const res = await window.electronAPI.checkSession();
      if (res && res.authenticated) {
        this.unlockApp(res.user);
      } else {
        this.lockApp();
      }
    } catch (e) {
      this.lockApp();
    }
  },

  unlockApp(user) {
    const gate = document.getElementById('login-gate');
    if (gate) gate.style.display = 'none';
  },

  lockApp() {
    const gate = document.getElementById('login-gate');
    if (gate) {
      gate.style.display = 'flex';
      const pass = document.getElementById('login-password');
      if (pass) {
        pass.value = '';
        pass.focus();
      }
      const err = document.getElementById('login-error-msg');
      if (err) err.style.display = 'none';
    }
  },

  async triggerCloudPull(userInitiated = false) {
    if (userInitiated) App.showToast('Syncing with Supabase Cloud...', 'info');
    try {
      const res = await window.electronAPI.pullFromCloud();
      if (res && res.success) {
        if (userInitiated) App.showToast('Cloud database merged successfully!', 'success');
        this.checkCloudStatus();
        // Refresh active view
        if (this.activeView === 'dashboard' && window.DashboardController) {
          window.DashboardController.loadDashboard();
        } else if (this.activeView === 'customers' && window.CustomersController) {
          window.CustomersController.loadCustomers();
        } else if (this.activeView === 'reports' && window.ReportsController) {
          window.ReportsController.loadReports();
        }
      } else if (userInitiated) {
        App.showToast(res ? res.message : 'Cloud sync not available', 'warning');
      }
    } catch (err) {
      if (userInitiated) App.showToast('Cloud sync notice: ' + err.message, 'warning');
    }
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
          dot.className = 'pulse-dot warn';
          text.textContent = 'Excel Open (Locked)';
        } else if (status.success) {
          dot.className = 'pulse-dot';
          text.textContent = 'Excel Synced';
        } else {
          dot.className = 'pulse-dot warn';
          text.textContent = 'Sync Pending';
        }
      }
    } catch (e) {
      console.warn('Sync status check error:', e);
    }
  },

  async checkCloudStatus() {
    try {
      if (!window.electronAPI || !window.electronAPI.getSupabaseStatus) return;
      const res = await window.electronAPI.getSupabaseStatus();
      const dot = document.getElementById('cloud-sync-dot');
      const text = document.getElementById('cloud-sync-text');
      const badge = document.getElementById('cloud-status-badge');

      if (res && res.connected) {
        if (dot) dot.style.background = '#10B981';
        if (text) text.textContent = res.tablesReady ? 'Cloud Synced' : 'Cloud Setup Needed';
        if (badge) {
          badge.textContent = res.tablesReady ? 'Online' : 'Pending SQL';
          badge.className = res.tablesReady ? 'badge badge-success' : 'badge badge-warning';
        }
      } else {
        if (dot) dot.style.background = '#64748B';
        if (text) text.textContent = 'Cloud Offline';
        if (badge) {
          badge.textContent = 'Offline';
          badge.className = 'badge badge-neutral';
        }
      }
    } catch (e) {
      console.warn('Check cloud status notice:', e);
    }
  },

  showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
      success: '#icon-check',
      error:   '#icon-close',
      warning: '#icon-sync',
      info:    '#icon-clock'
    };
    const iconHref = iconMap[type] || '#icon-clock';
    const titleText = title || { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' }[type] || 'Notice';

    toast.innerHTML = `
      <div class="toast-icon">
        <svg><use href="${iconHref}"/></svg>
      </div>
      <div class="toast-text">
        <div class="toast-title">${titleText}</div>
        <div class="toast-msg">${message}</div>
      </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(110%)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
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
