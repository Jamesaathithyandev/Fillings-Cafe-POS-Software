// Sree Sai Fillings Cafe - Receipt & Kitchen Bill Printing Controller

const ReceiptController = {
  currentOrder: null,
  activeView: 'both', // 'both', 'customer', 'chef'

  init() {
    const btnClose = document.getElementById('btn-close-receipt');
    const btnDismiss = document.getElementById('btn-receipt-dismiss');
    const btnPrint = document.getElementById('btn-receipt-print-action');
    const btnPrintChef = document.getElementById('btn-print-chef-only');

    if (btnClose) btnClose.addEventListener('click', () => this.hideModal());
    if (btnDismiss) btnDismiss.addEventListener('click', () => this.hideModal());
    if (btnPrint) btnPrint.addEventListener('click', () => this.printReceipt(this.activeView));
    if (btnPrintChef) btnPrintChef.addEventListener('click', () => this.printReceipt('chef'));

    // Preview Mode Tabs
    const tabs = document.querySelectorAll('.receipt-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeView = tab.getAttribute('data-view') || 'both';
        this.renderPreview();
      });
    });
  },

  showReceipt(order) {
    this.currentOrder = order;
    this.activeView = 'both';

    // Reset tab active state
    const tabs = document.querySelectorAll('.receipt-tab-btn');
    tabs.forEach(t => {
      if (t.getAttribute('data-view') === 'both') t.classList.add('active');
      else t.classList.remove('active');
    });

    this.renderPreview();

    const modal = document.getElementById('modal-receipt');
    if (modal) modal.classList.add('open');
  },

  hideModal() {
    const modal = document.getElementById('modal-receipt');
    if (modal) modal.classList.remove('open');
  },

  renderPreview() {
    const container = document.getElementById('receipt-printable-area');
    if (!container || !this.currentOrder) return;

    const lblPrint = document.getElementById('lbl-print-action');

    if (this.activeView === 'customer') {
      container.innerHTML = this.generateCustomerBillHtml(this.currentOrder);
      if (lblPrint) lblPrint.textContent = 'Print Customer Bill';
    } else if (this.activeView === 'chef') {
      container.innerHTML = this.generateChefSlipHtml(this.currentOrder);
      if (lblPrint) lblPrint.textContent = 'Print Chef Slip';
    } else {
      container.innerHTML = this.generateDualBillHtml(this.currentOrder);
      if (lblPrint) lblPrint.textContent = 'Print Both Bills';
    }
  },

  /**
   * 1. Customer Bill (Full Bill with Branding, Prices, Discounts, Totals & Payment Info)
   */
  generateCustomerBillHtml(order) {
    const itemsHtml = (order.items || []).map(item => `
      <tr>
        <td style="width:48%; text-align:left;">${item.item_name}</td>
        <td style="width:14%; text-align:center;">${item.quantity}</td>
        <td style="width:18%; text-align:right;">₹${parseFloat(item.unit_price).toFixed(2)}</td>
        <td style="width:20%; text-align:right;">₹${parseFloat(item.total_price).toFixed(2)}</td>
      </tr>
    `).join('');

    const discountHtml = order.discount > 0 ? `
      <div class="receipt-calc-row">
        <span>Discount (${order.discount_type === 'percent' ? '%' : 'Flat'}):</span>
        <span>- ₹${parseFloat(order.discount).toFixed(2)}</span>
      </div>
    ` : '';

    const orderType = order.order_type || 'Dine-In';
    const pkgCharge = parseFloat(order.packaging_charge) || 0;
    const packagingHtml = pkgCharge > 0 ? `
      <div class="receipt-calc-row">
        <span>Packaging (Takeaway):</span>
        <span>+ ₹${pkgCharge.toFixed(2)}</span>
      </div>
    ` : '';

    return `
      <div class="receipt-slip customer-slip">
        <div class="receipt-header">
          <div class="receipt-brand-title">SREE SAI FILLINGS CAFE</div>
          <div class="receipt-brand-tagline">LIVE &amp; XCLUSIVE EAT CLUB</div>
          <div class="receipt-brand-address">
            No 61/1, 61/2, Sesi Avenue West, Church Road<br>
            Cheran Ma Nagar, Coimbatore - 641 035
          </div>
          <div class="receipt-brand-phone">Phone: 82200 88119</div>
        </div>

        <div class="receipt-divider"></div>

        <div class="receipt-meta-grid">
          <div class="receipt-meta-row">
            <span><strong>Bill No:</strong> ${order.order_number}</span>
            <span><strong>Date:</strong> ${order.order_date}</span>
          </div>
          <div class="receipt-meta-row">
            <span><strong>Type:</strong> ${orderType.toUpperCase()}</span>
            <span><strong>Time:</strong> ${order.order_time}</span>
          </div>
          <div class="receipt-meta-row">
            <span><strong>Customer:</strong> ${order.customer_name}</span>
            <span><strong>Pay Mode:</strong> ${order.payment_method}</span>
          </div>
          ${order.customer_phone ? `<div class="receipt-meta-row"><span><strong>Phone:</strong> ${order.customer_phone}</span></div>` : ''}
        </div>

        <div class="receipt-divider"></div>

        <table class="receipt-items-table">
          <thead>
            <tr>
              <th style="text-align:left;">Item</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Rate</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="receipt-divider"></div>

        <div class="receipt-calc-table">
          <div class="receipt-calc-row">
            <span>Subtotal:</span>
            <span>₹${parseFloat(order.subtotal).toFixed(2)}</span>
          </div>
          ${packagingHtml}
          ${discountHtml}
          <div class="receipt-calc-row total">
            <span>NET AMOUNT:</span>
            <span>₹${parseFloat(order.final_total).toFixed(2)}</span>
          </div>
        </div>

        <div class="receipt-footer">
          <div style="font-weight:bold; margin-bottom:2px;">"Made with Love"</div>
          <div>Thank You For Visiting Sree Sai Fillings!</div>
          <div>Please Visit Again &bull; Have A Great Day!</div>
        </div>
      </div>
    `;
  },

  /**
   * 2. Kitchen Order Ticket / Chef Slip
   * Order Details + Customer Name ONLY. NO PRICES, NO TOTALS, NO PAYMENT INFO.
   */
  generateChefSlipHtml(order) {
    const itemsHtml = (order.items || []).map(item => `
      <tr>
        <td class="kot-name" style="width:75%; padding:5px 0; font-size:13px; font-weight:700;">${item.item_name}</td>
        <td class="kot-qty" style="width:25%; padding:5px 0; font-size:15px; font-weight:900; text-align:center;">x ${item.quantity}</td>
      </tr>
    `).join('');

    const orderType = order.order_type || 'Dine-In';

    return `
      <div class="receipt-slip kot-slip">
        <div class="kot-title">*** KITCHEN ORDER TICKET ***</div>
        <div class="kot-subtitle">(CHEF / KITCHEN COPY)</div>

        <div class="receipt-divider" style="border-top:2px dashed #000;"></div>

        <div class="receipt-meta-grid" style="font-size:12px;">
          <div class="receipt-meta-row">
            <span><strong>KOT No:</strong> ${order.order_number}</span>
            <span><strong>Date:</strong> ${order.order_date}</span>
          </div>
          <div class="receipt-meta-row" style="align-items:center;">
            <span><strong>Time:</strong> ${order.order_time}</span>
            <span class="kot-badge">${orderType.toUpperCase()}</span>
          </div>
          <div class="receipt-meta-row" style="margin-top:3px;">
            <span><strong>Customer:</strong> <span style="font-size:13px; font-weight:900;">${order.customer_name}</span></span>
          </div>
          ${order.notes ? `<div style="margin-top:3px; font-size:11.5px; background:#eee; padding:3px 6px; border-radius:3px;"><strong>Note:</strong> ${order.notes}</div>` : ''}
        </div>

        <div class="receipt-divider" style="border-top:2px dashed #000;"></div>

        <table class="kot-items-table">
          <thead>
            <tr>
              <th style="text-align:left;">ORDER ITEM</th>
              <th style="text-align:center;">QTY</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="receipt-divider" style="border-top:2px dashed #000; margin-top:10px;"></div>

        <div style="text-align:center; font-size:11px; font-weight:900; margin-top:6px; letter-spacing:1px;">
          *** PREPARE FRESH &amp; HOT ***
        </div>
      </div>
    `;
  },

  /**
   * 3. Dual Receipt (Customer Bill + Tear Perforation + Chef Slip)
   */
  generateDualBillHtml(order) {
    const customerCopy = this.generateCustomerBillHtml(order);
    const chefCopy = this.generateChefSlipHtml(order);

    return `
      <div class="dual-receipt-container">
        ${customerCopy}

        <div class="receipt-tear-divider">
          <div class="tear-line">----------------------------------------</div>
          <div class="tear-text">&#9986; &mdash; &mdash; TEAR HERE (CHEF COPY BELOW) &mdash; &mdash; &#9986;</div>
          <div class="tear-line">----------------------------------------</div>
        </div>

        ${chefCopy}
      </div>
    `;
  },

  async printReceipt(view = 'both') {
    if (!this.currentOrder) return;

    let html = '';
    if (view === 'customer') {
      html = this.generateCustomerBillHtml(this.currentOrder);
    } else if (view === 'chef') {
      html = this.generateChefSlipHtml(this.currentOrder);
    } else {
      html = this.generateDualBillHtml(this.currentOrder);
    }
    
    try {
      if (window.electronAPI && window.electronAPI.printReceipt) {
        await window.electronAPI.printReceipt({ html });
      } else {
        window.print();
      }
    } catch (e) {
      console.warn('Print error:', e);
      window.print();
    }
  }
};

window.ReceiptController = ReceiptController;
document.addEventListener('DOMContentLoaded', () => {
  ReceiptController.init();
});
