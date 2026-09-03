// Sree Sai Fillings Cafe - Receipt & Bill Printing Controller

const ReceiptController = {
  currentOrder: null,

  init() {
    const btnClose = document.getElementById('btn-close-receipt');
    const btnDismiss = document.getElementById('btn-receipt-dismiss');
    const btnPrint = document.getElementById('btn-receipt-print-action');

    if (btnClose) btnClose.addEventListener('click', () => this.hideModal());
    if (btnDismiss) btnDismiss.addEventListener('click', () => this.hideModal());
    if (btnPrint) btnPrint.addEventListener('click', () => this.printReceipt());
  },

  showReceipt(order) {
    this.currentOrder = order;
    const container = document.getElementById('receipt-printable-area');
    if (!container) return;

    container.innerHTML = this.generateReceiptHtml(order);

    const modal = document.getElementById('modal-receipt');
    if (modal) modal.classList.add('open');
  },

  hideModal() {
    const modal = document.getElementById('modal-receipt');
    if (modal) modal.classList.remove('open');
  },

  generateReceiptHtml(order) {
    const itemsHtml = (order.items || []).map(item => `
      <tr>
        <td style="width:50%;">${item.item_name}</td>
        <td style="width:15%; text-align:center;">${item.quantity}</td>
        <td style="width:15%; text-align:right;">₹${parseFloat(item.unit_price).toFixed(2)}</td>
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
      <div class="receipt-header">
        <div class="receipt-brand-title">SREE SAI FILLINGS CAFE</div>
        <div class="receipt-brand-tagline">LIVE & XCLUSIVE EAT CLUB</div>
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
          <span><strong>Pay Mode:</strong> ${order.payment_method}</span>
        </div>
        <div class="receipt-meta-row">
          <span><strong>Customer:</strong> ${order.customer_name}</span>
          <span><strong>Phone:</strong> ${order.customer_phone}</span>
        </div>
      </div>

      <div class="receipt-divider"></div>

      <table class="receipt-items-table">
        <thead>
          <tr>
            <th>Item</th>
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
        <div>Please Visit Again • Have A Great Day!</div>
      </div>
    `;
  },

  async printReceipt() {
    if (!this.currentOrder) return;
    const html = this.generateReceiptHtml(this.currentOrder);
    
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

document.addEventListener('DOMContentLoaded', () => {
  ReceiptController.init();
});
