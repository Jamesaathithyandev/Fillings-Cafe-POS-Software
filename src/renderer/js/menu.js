// Sree Sai Fillings Cafe - Menu Management Controller

const MenuController = {
  menuItems: [],
  categories: [],
  selectedCategory: 'ALL',
  searchQuery: '',

  init() {
    this.bindEvents();
  },

  async refresh() {
    await this.loadData();
  },

  bindEvents() {
    const searchInput = document.getElementById('menu-mgmt-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderTable();
      });
    }

    const catFilter = document.getElementById('menu-mgmt-cat-filter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value;
        this.renderTable();
      });
    }

    const btnAddNew = document.getElementById('btn-menu-add-new');
    if (btnAddNew) {
      btnAddNew.addEventListener('click', () => this.openAddModal());
    }

    const btnCloseModal = document.getElementById('btn-close-menu-modal');
    const btnCancelModal = document.getElementById('btn-cancel-menu-item');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => this.closeModal());
    if (btnCancelModal) btnCancelModal.addEventListener('click', () => this.closeModal());

    const btnSaveItem = document.getElementById('btn-save-menu-item');
    if (btnSaveItem) {
      btnSaveItem.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSaveItem();
      });
    }
  },

  async loadData() {
    try {
      this.categories = await window.electronAPI.getCategories();
      this.menuItems = await window.electronAPI.getMenuItems(false); // all items including disabled

      // Populate Category Dropdown
      const catSelect = document.getElementById('menu-mgmt-cat-filter');
      const modalCatSelect = document.getElementById('menu-item-category');

      if (catSelect) {
        catSelect.innerHTML = `<option value="ALL">All Categories (${this.menuItems.length} items)</option>` +
          this.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        catSelect.value = this.selectedCategory;
      }

      if (modalCatSelect) {
        modalCatSelect.innerHTML = this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }

      this.renderTable();
    } catch (e) {
      console.warn('Menu load data error:', e);
      App.showToast('Failed to load menu data', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('menu-mgmt-table-body');
    if (!tbody) return;

    let list = this.menuItems;

    if (this.selectedCategory !== 'ALL') {
      list = list.filter(m => m.category_name === this.selectedCategory);
    }

    if (this.searchQuery) {
      list = list.filter(m => 
        m.name.toLowerCase().includes(this.searchQuery) ||
        m.category_name.toLowerCase().includes(this.searchQuery) ||
        (m.item_code && m.item_code.toLowerCase().includes(this.searchQuery))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
            No menu items found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr>
        <td><strong style="color:var(--text-amber);">${item.item_code}</strong></td>
        <td><strong>${item.name}</strong></td>
        <td><span style="background:var(--bg-input); padding:3px 8px; border-radius:4px; font-size:11px;">${item.category_name}</span></td>
        <td>
          <div class="price-edit-cell">
            <span>₹</span>
            <input type="number" class="price-input-quick" data-id="${item.id}" value="${item.price}" step="0.01" min="0">
          </div>
        </td>
        <td style="color:var(--text-muted); font-size:12px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${item.description || '-'}
        </td>
        <td>
          <label class="switch">
            <input type="checkbox" class="toggle-status" data-id="${item.id}" ${item.is_active === 1 ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm btn-edit-item" data-id="${item.id}">Edit</button>
            <button class="btn btn-danger btn-sm btn-del-item" data-id="${item.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Inline Quick Price Change Handler
    tbody.querySelectorAll('.price-input-quick').forEach(input => {
      input.addEventListener('change', async () => {
        const id = parseInt(input.getAttribute('data-id'), 10);
        const newPrice = parseFloat(input.value);
        if (isNaN(newPrice) || newPrice < 0) {
          App.showToast('Invalid price entered', 'warning');
          return;
        }

        const item = this.menuItems.find(m => m.id === id);
        if (item) {
          await window.electronAPI.updateMenuItem(id, {
            ...item,
            price: newPrice
          });
          item.price = newPrice;
          App.showToast(`Updated price for "${item.name}" to ₹${newPrice.toFixed(2)}`, 'success');
        }
      });
    });

    // Toggle Active Status
    tbody.querySelectorAll('.toggle-status').forEach(checkbox => {
      checkbox.addEventListener('change', async () => {
        const id = parseInt(checkbox.getAttribute('data-id'), 10);
        const res = await window.electronAPI.toggleMenuItemStatus(id);
        const item = this.menuItems.find(m => m.id === id);
        if (item) item.is_active = res.is_active;
        App.showToast(`Item is now ${res.is_active === 1 ? 'Active' : 'Disabled'}`, 'info');
      });
    });

    // Edit Item
    tbody.querySelectorAll('.btn-edit-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        this.openEditModal(id);
      });
    });

    // Delete Item
    tbody.querySelectorAll('.btn-del-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const item = this.menuItems.find(m => m.id === id);
        if (!item) return;

        if (confirm(`Are you sure you want to remove "${item.name}"?`)) {
          const res = await window.electronAPI.deleteMenuItem(id);
          App.showToast(res.message, 'info');
          await this.loadData();
        }
      });
    });
  },

  openAddModal() {
    const title = document.getElementById('menu-modal-title');
    if (title) title.textContent = 'Add New Menu Item';

    document.getElementById('menu-item-id').value = '';
    document.getElementById('menu-item-name').value = '';
    document.getElementById('menu-item-price').value = '';
    document.getElementById('menu-item-desc').value = '';
    document.getElementById('menu-item-active').checked = true;

    const modal = document.getElementById('modal-menu-item');
    if (modal) modal.classList.add('open');
  },

  openEditModal(id) {
    const item = this.menuItems.find(m => m.id === id);
    if (!item) return;

    const title = document.getElementById('menu-modal-title');
    if (title) title.textContent = `Edit Menu Item: ${item.name}`;

    document.getElementById('menu-item-id').value = item.id;
    document.getElementById('menu-item-name').value = item.name;
    document.getElementById('menu-item-category').value = item.category_id;
    document.getElementById('menu-item-price').value = item.price;
    document.getElementById('menu-item-desc').value = item.description || '';
    document.getElementById('menu-item-active').checked = item.is_active === 1;

    const modal = document.getElementById('modal-menu-item');
    if (modal) modal.classList.add('open');
  },

  closeModal() {
    const modal = document.getElementById('modal-menu-item');
    if (modal) modal.classList.remove('open');
  },

  async handleSaveItem() {
    const id = document.getElementById('menu-item-id').value;
    const name = document.getElementById('menu-item-name').value.trim();
    const category_id = parseInt(document.getElementById('menu-item-category').value, 10);
    const price = parseFloat(document.getElementById('menu-item-price').value);
    const description = document.getElementById('menu-item-desc').value.trim();
    const is_active = document.getElementById('menu-item-active').checked ? 1 : 0;

    if (!name || isNaN(price) || price < 0) {
      App.showToast('Please provide a valid item name and price.', 'warning');
      return;
    }

    try {
      if (id) {
        // Edit existing
        await window.electronAPI.updateMenuItem(parseInt(id, 10), {
          category_id,
          name,
          price,
          description,
          is_active
        });
        App.showToast(`Updated "${name}" successfully!`, 'success');
      } else {
        // Add new
        await window.electronAPI.addMenuItem({
          category_id,
          name,
          price,
          description,
          is_active
        });
        App.showToast(`Added "${name}" to menu!`, 'success');
      }

      this.closeModal();
      await this.loadData();

    } catch (err) {
      console.error('Save item error:', err);
      App.showToast(`Error: ${err.message}`, 'error');
    }
  }
};

window.MenuController = MenuController;
document.addEventListener('DOMContentLoaded', () => {
  MenuController.init();
});
