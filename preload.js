// Sree Sai Fillings Cafe - Preload Bridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App Info & System
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  isFirstLaunch: () => ipcRenderer.invoke('app:isFirstLaunch'),
  onFirstLaunchRestore: (callback) => ipcRenderer.on('app:firstLaunchRestore', callback),
  openDataFolder: () => ipcRenderer.invoke('system:openDataFolder'),
  openExcelFile: () => ipcRenderer.invoke('system:openExcelFile'),
  printReceipt: (options) => ipcRenderer.invoke('system:printReceipt', options),
  directPrint: (options) => ipcRenderer.invoke('system:directPrint', options),

  // Printer Management
  getPrinters: () => ipcRenderer.invoke('printers:getList'),
  saveDefaultPrinter: (name) => ipcRenderer.invoke('printers:saveDefault', name),
  getDefaultPrinter: () => ipcRenderer.invoke('printers:getDefault'),

  // Customers
  searchCustomers: (query, limit) => ipcRenderer.invoke('customers:search', query, limit),
  getAllCustomers: () => ipcRenderer.invoke('customers:getAll'),
  getCustomerById: (id) => ipcRenderer.invoke('customers:getById', id),
  getCustomerByPhone: (phone) => ipcRenderer.invoke('customers:getByPhone', phone),
  createOrUpdateCustomer: (data) => ipcRenderer.invoke('customers:createOrUpdate', data),
  getCustomerOrders: (customerId) => ipcRenderer.invoke('customers:getOrders', customerId),

  // Menu Management
  getCategories: () => ipcRenderer.invoke('menu:getCategories'),
  getMenuItems: (onlyActive) => ipcRenderer.invoke('menu:getItems', onlyActive),
  addMenuItem: (data) => ipcRenderer.invoke('menu:addItem', data),
  updateMenuItem: (id, data) => ipcRenderer.invoke('menu:updateItem', id, data),
  toggleMenuItemStatus: (id) => ipcRenderer.invoke('menu:toggleStatus', id),
  deleteMenuItem: (id) => ipcRenderer.invoke('menu:deleteItem', id),

  // Orders & Billing
  getNextOrderNumber: () => ipcRenderer.invoke('orders:getNextNumber'),
  saveOrder: (orderPayload) => ipcRenderer.invoke('orders:save', orderPayload),
  getOrderDetails: (idOrNumber) => ipcRenderer.invoke('orders:getDetails', idOrNumber),
  getRecentOrders: (limit) => ipcRenderer.invoke('orders:getRecent', limit),
  getOpenOrders: () => ipcRenderer.invoke('orders:getOpen'),
  appendItemsToOrder: (orderId, newItems, options) => ipcRenderer.invoke('orders:appendItems', orderId, newItems, options),
  settleOrder: (orderId, paymentData) => ipcRenderer.invoke('orders:settle', orderId, paymentData),
  cancelOrder: (orderId, reason) => ipcRenderer.invoke('orders:cancel', orderId, reason),
  deleteOrder: (orderIdOrNumber) => ipcRenderer.invoke('orders:delete', orderIdOrNumber),

  // Dashboard & Reports
  getDashboardSummary: () => ipcRenderer.invoke('dashboard:getSummary'),
  getDailySales: (limitDays) => ipcRenderer.invoke('reports:getDaily', limitDays),
  getMonthlySales: () => ipcRenderer.invoke('reports:getMonthly'),
  getDateRangeReport: (fromDate, toDate) => ipcRenderer.invoke('reports:getDateRange', fromDate, toDate),
  getTopSellingItems: (limit) => ipcRenderer.invoke('reports:getTopItems', limit),

  // Excel Synchronization & Export
  syncExcel: () => ipcRenderer.invoke('excel:sync'),
  getExcelStatus: () => ipcRenderer.invoke('excel:getStatus'),
  exportExcelDialog: () => ipcRenderer.invoke('excel:export'),

  // Cloud & Backup
  createBackup: () => ipcRenderer.invoke('backup:create'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (fileName) => ipcRenderer.invoke('backup:restore', fileName),
  getSupabaseStatus: () => ipcRenderer.invoke('supabase:getStatus'),
  selectAndRestoreBackup: () => ipcRenderer.invoke('backup:selectAndRestore'),

  // Authentication & Multi-PC Cloud Sync
  login: (username, password, rememberMe) => ipcRenderer.invoke('auth:login', username, password, rememberMe),
  logout: () => ipcRenderer.invoke('auth:logout'),
  checkSession: () => ipcRenderer.invoke('auth:checkSession'),
  pullFromCloud: () => ipcRenderer.invoke('cloud:pullSync'),
  syncCloud: () => ipcRenderer.invoke('cloud:fullSync'),
  updateCloudData: () => ipcRenderer.invoke('cloud:updateOfflineData'),
  getPendingCloudCount: () => ipcRenderer.invoke('cloud:getPendingCount'),

  // Expenses & Purchases
  addExpense: (data) => ipcRenderer.invoke('expenses:add', data),
  getAllExpenses: (filters) => ipcRenderer.invoke('expenses:getAll', filters),
  deleteExpense: (id) => ipcRenderer.invoke('expenses:delete', id),
  getExpenseSummary: () => ipcRenderer.invoke('expenses:getSummary'),
  getProfitSummary: () => ipcRenderer.invoke('expenses:getProfitSummary'),

  // Google Sheets Live Sync
  getGoogleSheetsStatus: () => ipcRenderer.invoke('googleSheets:getStatus'),
  saveGoogleSheetsConfig: (cfg) => ipcRenderer.invoke('googleSheets:saveConfig', cfg),
  testGoogleSheetsConnection: () => ipcRenderer.invoke('googleSheets:testConnection'),
  syncGoogleSheetsNow: () => ipcRenderer.invoke('googleSheets:syncNow'),
  openGoogleSheet: () => ipcRenderer.invoke('googleSheets:openSheet')
});

