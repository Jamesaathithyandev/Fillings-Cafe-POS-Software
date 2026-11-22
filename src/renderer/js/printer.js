// Sree Sai Fillings Cafe - Printer Settings Controller
// Manages: printer selection, saving, and single-click silent printing

const PrinterController = {
  selectedPrinterName: null,  // currently highlighted in modal (not yet saved)
  defaultPrinterName: null,   // saved & active printer

  async init() {
    // Load saved printer from main process or auto-detect
    try {
      const settings = await window.electronAPI.getDefaultPrinter();
      if (settings && settings.defaultPrinterName) {
        this.defaultPrinterName = settings.defaultPrinterName;
      } else {
        // Auto-detect POS/Thermal printer if none configured yet
        const printers = await window.electronAPI.getPrinters();
        if (printers && printers.length > 0) {
          const thermal = printers.find(p => /pos|thermal|receipt|80|peripage|epson|star|citizen|bixolon|xprinter|tvs/i.test(p.name));
          const autoName = thermal ? thermal.name : (printers.find(p => p.isDefault) || printers[0]).name;
          if (autoName) {
            this.defaultPrinterName = autoName;
            await window.electronAPI.saveDefaultPrinter(autoName);
          }
        }
      }
      this.updatePrinterStatusLabel();
    } catch (e) {
      console.warn('Could not load printer settings:', e);
    }

    this.bindEvents();
  },

  bindEvents() {
    // Open modal
    const btnSetup = document.getElementById('btn-printer-setup');
    if (btnSetup) {
      btnSetup.addEventListener('click', () => this.openModal());
    }

    // Close modal
    const btnClose = document.getElementById('btn-printer-modal-close');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.closeModal());
    }

    // Close modal on backdrop click
    const modal = document.getElementById('modal-printer-setup');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    }

    // Save button
    const btnSave = document.getElementById('btn-printer-save');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.savePrinter());
    }

    // Test Print button
    const btnTest = document.getElementById('btn-printer-test-print');
    if (btnTest) {
      btnTest.addEventListener('click', () => this.testPrint());
    }
  },

  async openModal() {
    const modal = document.getElementById('modal-printer-setup');
    if (!modal) return;

    modal.style.display = 'flex';

    // Show current status if a printer is already saved
    const statusEl = document.getElementById('printer-current-status');
    const currentNameEl = document.getElementById('printer-current-name');
    if (this.defaultPrinterName && statusEl && currentNameEl) {
      currentNameEl.textContent = this.defaultPrinterName;
      statusEl.style.display = 'block';
    } else if (statusEl) {
      statusEl.style.display = 'none';
    }

    // Reset selection
    this.selectedPrinterName = this.defaultPrinterName;

    // Load printer list
    await this.loadPrinterList();
  },

  closeModal() {
    const modal = document.getElementById('modal-printer-setup');
    if (modal) modal.style.display = 'none';
    this.selectedPrinterName = null;
  },

  async loadPrinterList() {
    const container = document.getElementById('printer-list-container');
    if (!container) return;

    container.innerHTML = `<div style="color:#64748b; font-size:13px; padding:20px; text-align:center;">🔍 Scanning printers...</div>`;

    let printers = [];
    try {
      printers = await window.electronAPI.getPrinters();
    } catch (e) {
      container.innerHTML = `<div style="color:#f87171; font-size:13px; padding:20px; text-align:center;">❌ Could not fetch printer list.<br><small>${e.message}</small></div>`;
      return;
    }

    if (!printers || printers.length === 0) {
      container.innerHTML = `<div style="color:#f59e0b; font-size:13px; padding:20px; text-align:center;">⚠️ No printers found on this PC.<br><small>Make sure your POS-80 printer is plugged in & turned on.</small></div>`;
      return;
    }

    container.innerHTML = printers.map(p => {
      const isSelected = p.name === (this.selectedPrinterName || this.defaultPrinterName);
      const isThermal = /pos|thermal|receipt|80|peripage|epson|star|citizen|bixolon|xprinter|tvs/i.test(p.name);
      return `
        <div class="printer-card ${isSelected ? 'selected' : ''}" data-name="${p.name}"
          style="
            background: ${isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'};
            border: 1.5px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.08)'};
            border-radius: 12px; padding: 12px 16px; cursor: pointer;
            display: flex; align-items: center; gap: 12px;
            transition: all 0.2s; user-select: none;
          ">
          <div style="font-size:24px;">${isThermal ? '🧾' : '🖨️'}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:700; color:#f1f5f9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
            <div style="font-size:11px; color:#64748b; margin-top:1px;">
              ${p.isDefault ? '✦ System Default · ' : ''}${p.status === 0 ? 'Ready' : 'Offline/Busy'}
              ${isThermal ? ' · <span style="color:#86efac;">🟢 Thermal/POS Printer (Auto-cut)</span>' : ''}
            </div>
          </div>
          ${isSelected ? '<div style="color:#818cf8; font-size:18px;">✓</div>' : ''}
        </div>
      `;
    }).join('');

    // Add click listeners
    container.querySelectorAll('.printer-card').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.printer-card').forEach(c => {
          c.style.background = 'rgba(255,255,255,0.04)';
          c.style.border = '1.5px solid rgba(255,255,255,0.08)';
          c.innerHTML = c.innerHTML.replace(/<div style="color:#818cf8.*?<\/div>/, '');
        });
        card.style.background = 'rgba(99,102,241,0.2)';
        card.style.border = '1.5px solid #6366f1';
        this.selectedPrinterName = card.getAttribute('data-name');

        // Enable save button
        const btnSave = document.getElementById('btn-printer-save');
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.style.opacity = '1';
        }
      });
    });

    // Update save button state
    const btnSave = document.getElementById('btn-printer-save');
    if (btnSave) {
      const hasSelection = this.selectedPrinterName && this.selectedPrinterName.length > 0;
      btnSave.disabled = !hasSelection;
      btnSave.style.opacity = hasSelection ? '1' : '0.5';
    }
  },

  async savePrinter() {
    if (!this.selectedPrinterName) return;

    try {
      await window.electronAPI.saveDefaultPrinter(this.selectedPrinterName);
      this.defaultPrinterName = this.selectedPrinterName;
      this.updatePrinterStatusLabel();

      if (typeof App !== 'undefined') {
        App.showToast(`✅ Printer set: ${this.selectedPrinterName}`, 'success');
      }

      this.closeModal();
    } catch (e) {
      console.error('Save printer error:', e);
      if (typeof App !== 'undefined') {
        App.showToast('Failed to save printer setting.', 'error');
      }
    }
  },

  updatePrinterStatusLabel() {
    const label = document.getElementById('pos-printer-name-label');
    if (label) {
      if (this.defaultPrinterName) {
        const shortName = this.defaultPrinterName.length > 28
          ? this.defaultPrinterName.substring(0, 25) + '...'
          : this.defaultPrinterName;
        label.textContent = shortName;
        label.style.color = '#86efac';
      } else {
        label.textContent = 'No printer set — click Printer Setup';
        label.style.color = '';
      }
    }
  },

  /**
   * Sends 2 test bills (Customer Bill cut + Chef KOT cut) to the selected/saved printer.
   */
  async testPrint() {
    const printerName = this.selectedPrinterName || this.defaultPrinterName;

    if (!printerName) {
      if (typeof App !== 'undefined') {
        App.showToast('Please select a printer first.', 'warning');
      }
      return;
    }

    const mockTestOrder = {
      order_number: 'TEST-001',
      customer_name: 'TEST CUSTOMER',
      customer_phone: '82200 88119',
      order_date: new Date().toLocaleDateString('en-IN'),
      order_time: new Date().toLocaleTimeString('en-IN'),
      order_type: 'Dine-In',
      payment_method: 'Cash',
      subtotal: 99.00,
      discount: 0,
      packaging_charge: 0,
      final_total: 99.00,
      notes: 'Test print verification',
      items: [
        { item_name: 'BBQ Quarter (2pcs)', quantity: 1, unit_price: 99.00, total_price: 99.00 }
      ]
    };

    try {
      if (typeof App !== 'undefined') {
        App.showToast(`🖨️ Sending 1 Bill + 1 KOT to ${printerName}...`, 'info');
      }

      const result = await window.electronAPI.directPrint({
        order: mockTestOrder,
        view: 'both',
        printerName
      });

      if (result && result.success) {
        if (typeof App !== 'undefined') {
          App.showToast(`🧪 Test Bill + KOT printed & cut to ${printerName}!`, 'success');
        }
      } else {
        if (typeof App !== 'undefined') {
          App.showToast(`Print failed: ${result ? result.message : 'unknown error'}. Check printer connection.`, 'error');
        }
      }
    } catch (e) {
      if (typeof App !== 'undefined') {
        App.showToast(`Print error: ${e.message}`, 'error');
      }
    }
  },

  /**
   * Send a receipt directly to the saved default printer — no dialog.
   * Returns true if printed, false if no printer configured or failed.
   */
  async directPrintReceipt(html, order = null, view = 'both') {
    try {
      const result = await window.electronAPI.directPrint({
        html,
        order,
        view,
        printerName: this.defaultPrinterName
      });
      return result && result.success;
    } catch (e) {
      console.warn('Direct receipt print error:', e);
      return false;
    }
  },

  isConfigured() {
    return !!this.defaultPrinterName;
  }
};

window.PrinterController = PrinterController;
document.addEventListener('DOMContentLoaded', () => {
  PrinterController.init();
});
