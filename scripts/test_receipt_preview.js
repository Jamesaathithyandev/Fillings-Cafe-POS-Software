// Test script: generates a receipt HTML for a mock "test" order and opens it in the browser
const fs = require('fs');
const path = require('path');

// Simulate what saveOrder returns for a test order
const mockTestOrder = {
  id: 0,
  order_number: 'TEST-ORD',
  customer_id: 0,
  customer_name: 'test',
  customer_phone: '0000000000',
  order_date: new Date().toISOString().split('T')[0],
  order_time: new Date().toTimeString().split(' ')[0],
  subtotal: 317,
  discount: 0,
  discount_type: 'flat',
  packaging_charge: 0,
  order_type: 'Dine-In',
  final_total: 317,
  payment_method: 'Cash',
  status: 'COMPLETED',
  notes: '',
  items: [
    { id: null, order_number: 'TEST-ORD', item_name: 'Chicken Biryani Half', category_name: 'Biryanis', quantity: 1, unit_price: 189, total_price: 189 },
    { id: null, order_number: 'TEST-ORD', item_name: 'Egg Parotta (2)', category_name: 'Parottas', quantity: 2, unit_price: 64, total_price: 128 }
  ],
  customer: { id: 0, customer_code: 'TEST-CUST', name: 'test', phone: '0000000000', total_orders: 0, total_spent: 0 },
  is_test: true
};

// Receipt HTML generator (mirrors receipt.js logic exactly)
function generateCustomerBillHtml(order) {
  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="width:48%; text-align:left;">${item.item_name}</td>
      <td style="width:14%; text-align:center;">${item.quantity}</td>
      <td style="width:18%; text-align:right;">&#8377;${parseFloat(item.unit_price).toFixed(2)}</td>
      <td style="width:20%; text-align:right;">&#8377;${parseFloat(item.total_price).toFixed(2)}</td>
    </tr>
  `).join('');

  const discountHtml = order.discount > 0 ? `
    <div class="receipt-calc-row">
      <span>Discount (${order.discount_type === 'percent' ? '%' : 'Flat'}):</span>
      <span>- &#8377;${parseFloat(order.discount).toFixed(2)}</span>
    </div>
  ` : '';

  const pkgCharge = parseFloat(order.packaging_charge) || 0;
  const packagingHtml = pkgCharge > 0 ? `
    <div class="receipt-calc-row">
      <span>Packaging (Takeaway):</span>
      <span>+ &#8377;${pkgCharge.toFixed(2)}</span>
    </div>
  ` : '';

  return `
    <div class="receipt-slip customer-slip">
      <div class="receipt-header">
        <div class="receipt-brand-title">Sree Sai Fillings Cafe</div>
        <div class="receipt-brand-tagline">Fresh & Tasty Every Day</div>
        <div class="receipt-brand-address">No. 123, Main Road, Chennai - 600001</div>
        <div class="receipt-brand-phone">Ph: 044-XXXX-XXXX</div>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-meta-grid">
        <div class="receipt-meta-row"><span>Bill No:</span><span><strong>${order.order_number}</strong></span></div>
        <div class="receipt-meta-row"><span>Date:</span><span>${order.order_date} ${order.order_time}</span></div>
        <div class="receipt-meta-row"><span>Type:</span><span>${order.order_type || 'Dine-In'}</span></div>
        <div class="receipt-meta-row"><span>Customer:</span><span>${order.customer_name}</span></div>
        <div class="receipt-meta-row"><span>Payment:</span><span>${order.payment_method}</span></div>
      </div>

      <div class="receipt-divider"></div>

      <table class="receipt-items-table">
        <thead>
          <tr>
            <th style="text-align:left;">ITEM</th>
            <th style="text-align:center;">QTY</th>
            <th style="text-align:right;">RATE</th>
            <th style="text-align:right;">AMT</th>
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
          <span>&#8377;${parseFloat(order.subtotal).toFixed(2)}</span>
        </div>
        ${packagingHtml}
        ${discountHtml}
        <div class="receipt-calc-row total">
          <span>TOTAL:</span>
          <span>&#8377;${parseFloat(order.final_total).toFixed(2)}</span>
        </div>
      </div>

      <div class="receipt-footer">
        <div>Thank you for dining with us!</div>
        <div>Visit again :)</div>
        ${order.is_test ? '<div style="margin-top:8px;border:2px dashed #f59e0b;padding:4px;color:#d97706;font-weight:bold;">** TEST RECEIPT - NOT SAVED **</div>' : ''}
      </div>
    </div>
  `;
}

function generateChefSlipHtml(order) {
  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td class="kot-name">${item.item_name}<br><small style="font-weight:400;font-size:10px;">${item.category_name}</small></td>
      <td class="kot-qty">${item.quantity}</td>
    </tr>
  `).join('');

  return `
    <div class="kot-slip">
      <div class="kot-title">KITCHEN ORDER TICKET</div>
      <div class="kot-subtitle">Sree Sai Fillings Cafe</div>
      <div style="text-align:center;margin-top:4px;">
        <span class="kot-badge">${order.order_number}</span>
      </div>
      <div class="receipt-divider" style="border-top:2px dashed #000;"></div>
      <div style="font-size:11px; display:flex; gap:12px; margin-bottom:4px;">
        <span><strong>Date:</strong> ${order.order_date}</span>
        <span><strong>Time:</strong> ${order.order_time}</span>
      </div>
      <div style="font-size:11px; margin-bottom:4px;">
        <span><strong>Type:</strong> ${order.order_type || 'Dine-In'}</span>
      </div>
      <div style="font-size:11px;">
        <span><strong>Customer:</strong> <span style="font-size:13px; font-weight:900;">${order.customer_name}</span></span>
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
}

const customerBill = generateCustomerBillHtml(mockTestOrder);
const chefSlip = generateChefSlipHtml(mockTestOrder);

const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt Test - Sree Sai Fillings Cafe</title>
  <style>
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; background: #f0f0f0; display: flex; justify-content: center; gap: 30px; padding: 30px; }
    .receipt-wrapper { background: white; padding: 16px; width: 300px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
    .receipt-header { text-align: center; margin-bottom: 10px; }
    .receipt-brand-title { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
    .receipt-brand-tagline { font-size: 10px; margin-top: 2px; }
    .receipt-brand-address { font-size: 10px; margin-top: 4px; line-height: 1.3; }
    .receipt-brand-phone { font-size: 11px; font-weight: 700; margin-top: 2px; }
    .receipt-divider { border-top: 1px dashed #000; margin: 8px 0; }
    .receipt-meta-grid { font-size: 11px; display: flex; flex-direction: column; gap: 3px; }
    .receipt-meta-row { display: flex; justify-content: space-between; }
    .receipt-items-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0; }
    .receipt-items-table th { border-bottom: 1px dashed #000; padding: 4px 0; text-transform: uppercase; font-size: 10px; }
    .receipt-items-table td { padding: 3px 0; }
    .receipt-calc-table { font-size: 11px; margin-top: 4px; }
    .receipt-calc-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .receipt-calc-row.total { font-size: 14px; font-weight: 900; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin: 4px 0; }
    .receipt-footer { text-align: center; font-size: 10px; margin-top: 10px; line-height: 1.4; }
    .kot-slip { padding-top: 6px; }
    .kot-title { font-size: 16px; font-weight: 900; letter-spacing: 1px; text-align: center; }
    .kot-subtitle { font-size: 11px; font-weight: 700; text-align: center; margin-top: 2px; }
    .kot-badge { display: inline-block; background: #000; color: #fff; font-weight: 900; font-size: 12px; padding: 2px 8px; border-radius: 3px; margin-top: 2px; }
    .kot-items-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    .kot-items-table th { border-bottom: 2px solid #000; padding: 5px 0; font-size: 11.5px; font-weight: 900; text-transform: uppercase; }
    .kot-items-table td { padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #ccc; }
    .kot-qty { font-size: 15px; font-weight: 900; text-align: center; }
    .kot-name { font-weight: 700; }
    h2 { font-family: sans-serif; text-align: center; margin-bottom: 8px; color: #333; font-size: 13px; }
  </style>
</head>
<body>
  <div>
    <h2>📄 Customer Bill</h2>
    <div class="receipt-wrapper">${customerBill}</div>
  </div>
  <div>
    <h2>👨‍🍳 Chef KOT Slip</h2>
    <div class="receipt-wrapper">${chefSlip}</div>
  </div>
</body>
</html>`;

const outPath = path.join(__dirname, '..', 'test-receipt-preview.html');
fs.writeFileSync(outPath, fullHtml, 'utf8');
console.log('✅ Receipt HTML generated at:');
console.log('   ' + outPath);
console.log('\nOpening in browser...');
