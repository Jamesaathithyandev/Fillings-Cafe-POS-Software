// Sree Sai Fillings Cafe - POS & Add Order Controller

const POSController = {
  categories: [],
  menuItems: [],
  selectedCategory: 'ALL',
  searchQuery: '',
  
  // Selected Customer State
  selectedCustomer: null,

  // Cart State
  cart: [], // [ { id, code, name, category, price, quantity, total } ]
  discount: 0,
  discountType: 'flat', // 'flat' or 'percent'
  paymentMethod: 'Cash',
  orderType: 'Dine-In', // 'Dine-In' or 'Takeaway'
  packagingCharge: 0,   // 0 for Dine-In, 15 for Takeaway

  init() {
    this.bindEvents();
    this.loadNextOrderNumber();
  },

  async onEnter() {
    await this.loadMenu();
    await this.loadNextOrderNumber();
    if (!this.selectedCustomer) {
      const quickForm = document.getElementById('pos-customer-quick-form');
      const searchWrap = document.getElementById('pos-search-wrap');
      const badge = document.getElementById('pos-customer-active-badge');
      if (quickForm) quickForm.style.display = 'flex';
      if (searchWrap) searchWrap.style.display = '';
      if (badge) badge.style.display = 'none';
    }
    const searchInput = document.getElementById('pos-customer-search-input');
    if (searchInput) searchInput.focus();
  },

  bindEvents() {
    // 1. Customer Search & Suggestion Events
    const custSearch = document.getElementById('pos-customer-search-input');
    const suggestionsBox = document.getElementById('pos-customer-suggestions');

    if (custSearch) {
      custSearch.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length === 0) {
          if (suggestionsBox) suggestionsBox.style.display = 'none';
          return;
        }

        const results = await window.electronAPI.searchCustomers(query, 6);
        this.renderCustomerSuggestions(results);
      });

      // Close suggestions on Escape key
      custSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && suggestionsBox) {
          suggestionsBox.style.display = 'none';
        }
      });

      // Close suggestions when clicked outside
      document.addEventListener('click', (e) => {
        if (suggestionsBox && !custSearch.contains(e.target) && !suggestionsBox.contains(e.target)) {
          suggestionsBox.style.display = 'none';
        }
      });
    }

    const btnClearCust = document.getElementById('btn-pos-clear-customer');
    if (btnClearCust) {
      btnClearCust.addEventListener('click', () => this.clearSelectedCustomer());
    }

    // 2. Menu Search & Filter
    const menuSearch = document.getElementById('pos-menu-search');
    if (menuSearch) {
      menuSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderMenuGrid();
      });
    }

    // 3. Cart Calculations & Discount
    const discountInput = document.getElementById('pos-discount-input');
    const discountTypeSelect = document.getElementById('pos-discount-type');

    if (discountInput) {
      discountInput.addEventListener('input', (e) => {
        this.discount = parseFloat(e.target.value) || 0;
        this.updateCartTotals();
      });
    }

    if (discountTypeSelect) {
      discountTypeSelect.addEventListener('change', (e) => {
        this.discountType = e.target.value;
        this.updateCartTotals();
      });
    }

    // 4. Payment Method Buttons
    const payBtns = document.querySelectorAll('.pay-tile-btn');
    payBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        payBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.paymentMethod = btn.getAttribute('data-method') || 'Cash';
      });
    });

    // 4b. Order Type Buttons (Dine-In vs Takeaway ₹5 vs Takeaway ₹10)
    const typeBtns = document.querySelectorAll('.order-type-btn');
    typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type') || 'Dine-In';
        const fee = parseFloat(btn.getAttribute('data-fee')) || 0;
        this.setOrderType(type, fee);
      });
    });

    // 5. Clear Cart
    const btnClearCart = document.getElementById('btn-pos-clear-cart');
    if (btnClearCart) {
      btnClearCart.addEventListener('click', () => {
        if (this.cart.length === 0) return;
        if (confirm('Are you sure you want to clear the current order?')) {
          this.clearCart();
        }
      });
    }

    // 6. Save & Print / Save Only Buttons
    const btnSavePrint = document.getElementById('btn-pos-save-print');
    if (btnSavePrint) {
      btnSavePrint.addEventListener('click', () => this.handleSaveOrder(true));
    }

    const btnSaveOnly = document.getElementById('btn-pos-save-only');
    if (btnSaveOnly) {
      btnSaveOnly.addEventListener('click', () => this.handleSaveOrder(false));
    }
  },

  async loadNextOrderNumber() {
    try {
      const nextNum = await window.electronAPI.getNextOrderNumber();
      const numEl = document.getElementById('pos-current-order-num');
      if (numEl) numEl.textContent = nextNum;
    } catch (e) {
      console.warn('Order number error:', e);
    }
  },

  // ----------------------------------------------------
  // Customer Handling
  // ----------------------------------------------------

  renderCustomerSuggestions(customers) {
    const box = document.getElementById('pos-customer-suggestions');
    if (!box) return;

    const wrap = document.getElementById('pos-search-wrap');

    if (!customers || customers.length === 0) {
      box.innerHTML = `
        <div class="suggestion-create" id="sug-create-new" style="cursor:pointer;">
          <svg><use href="#icon-plus"/></svg>
          <span>No saved customer found &mdash; type new details on right</span>
        </div>
      `;
      box.style.display = 'block';

      const createBtn = box.querySelector('#sug-create-new');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          box.style.display = 'none';
          const nameInput = document.getElementById('pos-input-name');
          if (nameInput) nameInput.focus();
        });
      }
      return;
    }

    box.innerHTML = customers.map(c => {
      const initials = (c.name || '?').charAt(0).toUpperCase();
      return `
        <div class="suggestion-item" data-id="${c.id}">
          <div class="sug-avatar">${initials}</div>
          <div class="sug-info">
            <div class="sug-name">${c.name}</div>
            <div class="sug-phone">${c.phone} &bull; ${c.customer_code || ''}</div>
          </div>
          <div class="sug-badge">${c.total_orders || 0} orders</div>
        </div>
      `;
    }).join('') + `
      <div class="suggestion-create" id="sug-create-new">
        <svg><use href="#icon-plus"/></svg>
        New customer &mdash; type details on right
      </div>
    `;

    box.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-id');
        const customer = await window.electronAPI.getCustomerById(id);
        if (customer) this.selectCustomer(customer);
        box.style.display = 'none';
      });
    });

    const createBtn = box.querySelector('#sug-create-new');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        box.style.display = 'none';
        const nameInput = document.getElementById('pos-input-name');
        if (nameInput) nameInput.focus();
      });
    }

    box.style.display = 'block';
  },

  selectCustomer(customer) {
    this.selectedCustomer = customer;

    const badge     = document.getElementById('pos-customer-active-badge');
    const badgeName = document.getElementById('pos-badge-name');
    const badgeAvtr = document.getElementById('pos-badge-avatar');
    const badgeStats= document.getElementById('pos-badge-stats');
    const quickForm = document.getElementById('pos-customer-quick-form');
    const searchBox = document.getElementById('pos-customer-search-input');
    const searchWrap= document.getElementById('pos-search-wrap');
    const sugBox    = document.getElementById('pos-customer-suggestions');

    if (badgeName) badgeName.textContent = customer.name;
    if (badgeAvtr) badgeAvtr.textContent = (customer.name || '?').charAt(0).toUpperCase();
    if (badgeStats) {
      badgeStats.textContent = `Spent: ₹${parseFloat(customer.total_spent || 0).toFixed(2)} \u2022 ${customer.total_orders || 0} Orders`;
    }

    if (badge)      badge.style.display = 'flex';
    if (quickForm)  quickForm.style.display = 'none';
    if (searchWrap) searchWrap.style.display = 'none';
    if (sugBox)     sugBox.style.display = 'none';
    if (searchBox)  searchBox.value = '';
  },

  clearSelectedCustomer() {
    this.selectedCustomer = null;
    const badge     = document.getElementById('pos-customer-active-badge');
    const quickForm = document.getElementById('pos-customer-quick-form');
    const searchWrap= document.getElementById('pos-search-wrap');
    const searchBox = document.getElementById('pos-customer-search-input');
    const sugBox    = document.getElementById('pos-customer-suggestions');

    if (badge)      badge.style.display = 'none';
    if (searchWrap) searchWrap.style.display = '';
    if (quickForm)  quickForm.style.display = 'flex';
    if (sugBox)     sugBox.style.display = 'none';
    if (searchBox) { searchBox.value = ''; searchBox.focus(); }
  },

  // ----------------------------------------------------
  // Menu Loading & Rendering
  // ----------------------------------------------------

  async loadMenu() {
    try {
      this.categories = await window.electronAPI.getCategories();
      this.menuItems = await window.electronAPI.getMenuItems(true); // only active items
      this.renderCategoryTabs();
      this.renderMenuGrid();
    } catch (e) {
      console.error('Menu load error:', e);
      App.showToast('Failed to load menu items', 'error');
    }
  },

  renderCategoryTabs() {
    const container = document.getElementById('pos-category-tabs');
    if (!container) return;

    const allCount = this.menuItems.length;
    let html = `
      <div class="cat-tab ${this.selectedCategory === 'ALL' ? 'active' : ''}" data-cat="ALL">
        All Items
        <span class="cat-count">${allCount}</span>
      </div>
    `;

    this.categories.forEach(cat => {
      const count = this.menuItems.filter(m => m.category_name === cat.name).length;
      const isActive = this.selectedCategory === cat.name;
      html += `
        <div class="cat-tab ${isActive ? 'active' : ''}" data-cat="${cat.name}">
          ${cat.name}
          <span class="cat-count">${count}</span>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.selectedCategory = tab.getAttribute('data-cat');
        container.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderMenuGrid();
      });
    });
  },

  renderMenuGrid() {
    const grid = document.getElementById('pos-menu-grid');
    if (!grid) return;

    let filtered = this.menuItems;

    // Filter by Category
    if (this.selectedCategory !== 'ALL') {
      filtered = filtered.filter(item => item.category_name === this.selectedCategory);
    }

    // Filter by Search Query
    if (this.searchQuery) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(this.searchQuery) ||
        item.category_name.toLowerCase().includes(this.searchQuery) ||
        (item.description && item.description.toLowerCase().includes(this.searchQuery))
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted);">
          No menu items found matching "${this.searchQuery || this.selectedCategory}".
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const inCart = this.cart.find(ci => ci.id === item.id);
      return `
        <div class="menu-card" data-id="${item.id}">
          <div class="menu-card-body">
            <div class="menu-card-name">${item.name}</div>
            <div class="menu-card-cat">${item.category_name}</div>
          </div>
          <div class="menu-card-footer">
            <span class="menu-card-price">₹${parseFloat(item.price).toFixed(2)}</span>
            <div class="menu-card-add">
              <svg><use href="#icon-plus"/></svg>
            </div>
          </div>
          ${inCart ? `<div style="position:absolute;top:6px;right:6px;background:var(--primary);color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);">${inCart.quantity}</div>` : ''}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.menu-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.getAttribute('data-id'), 10);
        const item = this.menuItems.find(m => m.id === id);
        if (item) this.addToCart(item);
      });
    });
  },

  // ----------------------------------------------------
  // Cart Actions & Real-time Calculations
  // ----------------------------------------------------

  addToCart(item) {
    const existingIndex = this.cart.findIndex(ci => ci.id === item.id);
    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += 1;
      this.cart[existingIndex].total = this.cart[existingIndex].quantity * this.cart[existingIndex].price;
    } else {
      this.cart.push({
        id: item.id,
        code: item.item_code,
        name: item.name,
        category: item.category_name,
        price: parseFloat(item.price),
        quantity: 1,
        total: parseFloat(item.price)
      });
    }

    this.renderCart();
    this.renderMenuGrid(); // Updates quantity badge
  },

  increaseQty(index) {
    if (this.cart[index]) {
      this.cart[index].quantity += 1;
      this.cart[index].total = this.cart[index].quantity * this.cart[index].price;
      this.renderCart();
      this.renderMenuGrid();
    }
  },

  decreaseQty(index) {
    if (this.cart[index]) {
      if (this.cart[index].quantity > 1) {
        this.cart[index].quantity -= 1;
        this.cart[index].total = this.cart[index].quantity * this.cart[index].price;
      } else {
        this.cart.splice(index, 1);
      }
      this.renderCart();
      this.renderMenuGrid();
    }
  },

  removeItem(index) {
    if (this.cart[index]) {
      this.cart.splice(index, 1);
      this.renderCart();
      this.renderMenuGrid();
    }
  },

  setOrderType(type, fee = 0) {
    this.orderType = type;
    this.packagingCharge = parseFloat(fee) || 0;

    document.querySelectorAll('.order-type-btn').forEach(btn => {
      const btnType = btn.getAttribute('data-type') || 'Dine-In';
      const btnFee = parseFloat(btn.getAttribute('data-fee')) || 0;
      if (btnType === type && btnFee === this.packagingCharge) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const pkgRow = document.getElementById('pos-row-packaging');
    const pkgValEl = document.getElementById('pos-calc-packaging');
    if (pkgRow) {
      pkgRow.style.display = (this.packagingCharge > 0 && this.cart.length > 0) ? 'flex' : 'none';
    }
    if (pkgValEl) {
      pkgValEl.textContent = `+ ₹${this.packagingCharge.toFixed(2)}`;
    }

    this.updateCartTotals();
  },

  clearCart() {
    this.cart = [];
    this.discount = 0;
    const discountInput = document.getElementById('pos-discount-input');
    if (discountInput) discountInput.value = 0;
    this.setOrderType('Dine-In', 0);
    this.renderCart();
    this.renderMenuGrid();
  },

  renderCart() {
    const list = document.getElementById('pos-cart-items-list');
    if (!list) return;

    if (this.cart.length === 0) {
      list.innerHTML = `
        <div class="cart-empty">
          <svg viewBox="0 0 120 100"><use href="#illus-empty-cart"/></svg>
          <div class="cart-empty-title">Cart is empty</div>
          <div class="cart-empty-sub">Tap any menu item to add it here</div>
        </div>
      `;
      this.updateCartTotals();
      return;
    }

    list.innerHTML = this.cart.map((item, index) => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-unit">${item.category} &bull; &#8377;${item.price.toFixed(2)} each</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn minus btn-minus" data-index="${index}">
            <svg><use href="#icon-minus"/></svg>
          </button>
          <div class="qty-display">${item.quantity}</div>
          <button class="qty-btn btn-plus" data-index="${index}">
            <svg><use href="#icon-plus"/></svg>
          </button>
        </div>
        <div class="cart-item-price">&#8377;${item.total.toFixed(2)}</div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-plus').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.increaseQty(parseInt(b.getAttribute('data-index'), 10));
      });
    });

    list.querySelectorAll('.btn-minus').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.decreaseQty(parseInt(b.getAttribute('data-index'), 10));
      });
    });

    this.updateCartTotals();
  },

  updateCartTotals() {
    let subtotal = 0;
    this.cart.forEach(item => {
      subtotal += item.total;
    });

    let calculatedDiscount = 0;
    if (this.discountType === 'percent') {
      calculatedDiscount = (subtotal * this.discount) / 100;
    } else {
      calculatedDiscount = this.discount;
    }
    if (calculatedDiscount > subtotal) calculatedDiscount = subtotal;

    // Apply packaging charge (₹5 or ₹10) only when Takeaway is active and items exist in cart
    const packaging = (this.cart.length > 0) ? this.packagingCharge : 0;
    const finalTotal = Math.max(0, subtotal + packaging - calculatedDiscount);

    const subtotalEl = document.getElementById('pos-calc-subtotal');
    const finalTotalEl = document.getElementById('pos-calc-final-total');
    const pkgRow = document.getElementById('pos-row-packaging');
    const pkgValEl = document.getElementById('pos-calc-packaging');

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    if (pkgRow) pkgRow.style.display = (packaging > 0) ? 'flex' : 'none';
    if (pkgValEl) pkgValEl.textContent = `+ ₹${packaging.toFixed(2)}`;
    if (finalTotalEl) finalTotalEl.textContent = `₹${finalTotal.toFixed(2)}`;
  },

  // ----------------------------------------------------
  // Save Order Workflow
  // ----------------------------------------------------

  async handleSaveOrder(shouldPrint = false) {
    // 1. Validation
    if (this.cart.length === 0) {
      App.showToast('Please add at least one menu item to the order.', 'warning');
      return;
    }

    // Customer resolution
    let customerData = null;
    if (this.selectedCustomer) {
      customerData = this.selectedCustomer;
    } else {
      const nameInput = document.getElementById('pos-input-name');
      const phoneInput = document.getElementById('pos-input-phone');
      const addressInput = document.getElementById('pos-input-address');
      const notesInput = document.getElementById('pos-input-notes');

      const name = nameInput ? nameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';

      if (!name || !phone) {
        App.showToast('Please enter Customer Name & Phone number.', 'warning');
        if (!name && nameInput) nameInput.focus();
        else if (!phone && phoneInput) phoneInput.focus();
        return;
      }

      customerData = {
        name,
        phone,
        address: addressInput ? addressInput.value.trim() : '',
        notes: notesInput ? notesInput.value.trim() : ''
      };
    }

    const appliedPkg = (this.cart.length > 0) ? this.packagingCharge : 0;
    const orderTypeLabel = (this.orderType === 'Takeaway' && appliedPkg > 0) ? `Takeaway (₹${appliedPkg})` : (this.orderType === 'Takeaway' ? 'Takeaway' : 'Dine-In');

    // 2. Build Payload
    const payload = {
      customer: customerData,
      items: this.cart,
      discount: this.discount,
      discount_type: this.discountType,
      payment_method: this.paymentMethod,
      order_type: orderTypeLabel,
      packaging_charge: appliedPkg,
      notes: ''
    };

    try {
      const savedOrder = await window.electronAPI.saveOrder(payload);
      App.showToast(`Order ${savedOrder.order_number} saved successfully!`, 'success');

      // 3. Clear State For Next Customer
      this.clearCart();
      this.clearSelectedCustomer();
      
      const nameInput = document.getElementById('pos-input-name');
      const phoneInput = document.getElementById('pos-input-phone');
      const addressInput = document.getElementById('pos-input-address');
      const notesInput = document.getElementById('pos-input-notes');
      if (nameInput) nameInput.value = '';
      if (phoneInput) phoneInput.value = '';
      if (addressInput) addressInput.value = '';
      if (notesInput) notesInput.value = '';

      await this.loadNextOrderNumber();

      // 4. Print / Show Receipt
      if (shouldPrint) {
        const rc = window.ReceiptController || (typeof ReceiptController !== 'undefined' ? ReceiptController : null);
        if (rc && rc.showReceipt) {
          rc.showReceipt(savedOrder);
        } else {
          console.warn('ReceiptController not found on window');
        }
      }

      // Check sync status in background
      App.checkExcelStatus();

    } catch (err) {
      console.error('Save order error:', err);
      App.showToast(`Failed to save order: ${err.message}`, 'error');
    }
  }
};

window.POSController = POSController;
document.addEventListener('DOMContentLoaded', () => {
  POSController.init();
});
