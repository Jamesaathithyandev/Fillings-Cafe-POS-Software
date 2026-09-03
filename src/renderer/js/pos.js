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

  init() {
    this.bindEvents();
    this.loadNextOrderNumber();
  },

  async onEnter() {
    await this.loadMenu();
    await this.loadNextOrderNumber();
    // Focus customer search
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
          suggestionsBox.classList.remove('show');
          return;
        }

        const results = await window.electronAPI.searchCustomers(query, 6);
        this.renderCustomerSuggestions(results);
      });

      // Close suggestions when clicked outside
      document.addEventListener('click', (e) => {
        if (!custSearch.contains(e.target) && !suggestionsBox.contains(e.target)) {
          suggestionsBox.classList.remove('show');
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
    const payBtns = document.querySelectorAll('.btn-payment');
    payBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        payBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.paymentMethod = btn.getAttribute('data-method') || 'Cash';
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

    if (!customers || customers.length === 0) {
      box.innerHTML = `
        <div style="padding:10px 14px; font-size:12px; color:var(--text-muted);">
          No existing customer found. Enter details in the fields to the right.
        </div>
      `;
      box.classList.add('show');
      return;
    }

    box.innerHTML = customers.map(c => `
      <div class="suggestion-item" data-id="${c.id}">
        <div>
          <div class="suggestion-name">${c.name}</div>
          <div class="suggestion-phone">${c.phone} • ${c.customer_code || ''}</div>
        </div>
        <div class="suggestion-stats">
          <div>${c.total_orders || 0} Orders</div>
          <div style="font-weight:700;">₹${parseFloat(c.total_spent || 0).toFixed(2)}</div>
        </div>
      </div>
    `).join('');

    box.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-id');
        const customer = await window.electronAPI.getCustomerById(id);
        if (customer) {
          this.selectCustomer(customer);
        }
        box.classList.remove('show');
      });
    });

    box.classList.add('show');
  },

  selectCustomer(customer) {
    this.selectedCustomer = customer;

    // Show Badge
    const badge = document.getElementById('pos-customer-active-badge');
    const badgeName = document.getElementById('pos-badge-name');
    const badgePhone = document.getElementById('pos-badge-phone');
    const badgeStats = document.getElementById('pos-badge-stats');
    const quickForm = document.getElementById('pos-customer-quick-form');
    const searchBox = document.getElementById('pos-customer-search-input');

    if (badgeName) badgeName.textContent = customer.name;
    if (badgePhone) badgePhone.textContent = customer.phone;
    if (badgeStats) {
      badgeStats.textContent = `Spent: ₹${parseFloat(customer.total_spent || 0).toFixed(2)} • ${customer.total_orders || 0} Orders (Last: ${customer.last_order_date || 'None'})`;
    }

    if (badge) badge.style.display = 'flex';
    if (quickForm) quickForm.style.display = 'none';
    if (searchBox) searchBox.value = '';
  },

  clearSelectedCustomer() {
    this.selectedCustomer = null;
    const badge = document.getElementById('pos-customer-active-badge');
    const quickForm = document.getElementById('pos-customer-quick-form');
    const searchBox = document.getElementById('pos-customer-search-input');

    if (badge) badge.style.display = 'none';
    if (quickForm) quickForm.style.display = 'flex';
    if (searchBox) {
      searchBox.value = '';
      searchBox.focus();
    }
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

    let html = `
      <div class="cat-tab ${this.selectedCategory === 'ALL' ? 'active' : ''}" data-cat="ALL">
        <span>✨</span>
        <span>ALL ITEMS</span>
      </div>
    `;

    this.categories.forEach(cat => {
      const isActive = this.selectedCategory === cat.name;
      html += `
        <div class="cat-tab ${isActive ? 'active' : ''}" data-cat="${cat.name}">
          <span>${cat.icon || '🍽️'}</span>
          <span>${cat.name}</span>
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
      const qtyBadge = inCart ? `<div class="card-qty-badge">${inCart.quantity}</div>` : '';

      return `
        <div class="menu-card" data-id="${item.id}">
          ${qtyBadge}
          <div>
            <div class="card-cat-badge">${item.category_name}</div>
            <div class="card-item-name">${item.name}</div>
          </div>
          <div class="card-bottom-row">
            <span class="card-item-price">₹${parseFloat(item.price).toFixed(2)}</span>
            <span class="card-add-icon">+</span>
          </div>
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

  clearCart() {
    this.cart = [];
    this.discount = 0;
    const discountInput = document.getElementById('pos-discount-input');
    if (discountInput) discountInput.value = 0;
    this.renderCart();
    this.renderMenuGrid();
  },

  renderCart() {
    const list = document.getElementById('pos-cart-items-list');
    if (!list) return;

    if (this.cart.length === 0) {
      list.innerHTML = `
        <div class="cart-empty-state">
          <span style="font-size:32px;">🛒</span>
          <div>Your cart is empty</div>
          <div style="font-size:12px;">Click any menu item on the left to add</div>
        </div>
      `;
      this.updateCartTotals();
      return;
    }

    list.innerHTML = this.cart.map((item, index) => `
      <div class="cart-item-row">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-rate">${item.category} • ₹${item.price.toFixed(2)}</div>
        </div>

        <div class="cart-qty-controls">
          <button class="btn-qty btn-minus" data-index="${index}">-</button>
          <span class="cart-qty-value">${item.quantity}</span>
          <button class="btn-qty btn-plus" data-index="${index}">+</button>
        </div>

        <div class="cart-item-total">₹${item.total.toFixed(2)}</div>

        <button class="btn-remove-item" data-index="${index}" title="Remove item">🗑️</button>
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

    list.querySelectorAll('.btn-remove-item').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeItem(parseInt(b.getAttribute('data-index'), 10));
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

    const finalTotal = Math.max(0, subtotal - calculatedDiscount);

    const subtotalEl = document.getElementById('pos-calc-subtotal');
    const finalTotalEl = document.getElementById('pos-calc-final-total');

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
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

    // 2. Build Payload
    const payload = {
      customer: customerData,
      items: this.cart,
      discount: this.discount,
      discount_type: this.discountType,
      payment_method: this.paymentMethod,
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
      if (shouldPrint && window.ReceiptController) {
        window.ReceiptController.showReceipt(savedOrder);
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
