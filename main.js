// Sree Sai Fillings Cafe - Electron Main Process
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    globalThis.WebSocket = require('ws');
  } catch (e) {}
}

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const dbManager = require('./src/database/db');
const queries = require('./src/database/queries');
const excelSync = require('./src/excel/excelSync');
const backupManager = require('./src/backup/backupManager');
const supabaseSync = require('./src/supabase/supabaseSync');
const googleSheetsSync = require('./src/google/googleSheetsSync');
const authManager = require('./src/auth/authManager');
const escposPrinter = require('./src/printer/escposPrinter');

let mainWindow = null;
let isFirstLaunch = false; // Set to true when a fresh install is detected

// ─── Printer Settings Helpers ──────────────────────────────────────────────
let printerSettingsPath = null; // set after app ready

function getPrinterSettings() {
  try {
    if (printerSettingsPath && fs.existsSync(printerSettingsPath)) {
      return JSON.parse(fs.readFileSync(printerSettingsPath, 'utf8'));
    }
  } catch (e) {}
  return { defaultPrinterName: null };
}

function savePrinterSettings(settings) {
  try {
    if (printerSettingsPath) {
      fs.writeFileSync(printerSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn('Could not save printer settings:', e.message);
  }
}

async function resolvePrinterName(requestedName) {
  if (requestedName) return requestedName;
  const settings = getPrinterSettings();
  if (settings && settings.defaultPrinterName) return settings.defaultPrinterName;

  // Auto-detect POS/Thermal or system default printer
  try {
    let printers = [];
    if (mainWindow && mainWindow.webContents) {
      if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
        printers = await mainWindow.webContents.getPrintersAsync();
      } else if (typeof mainWindow.webContents.getPrinters === 'function') {
        printers = mainWindow.webContents.getPrinters();
      }
    }
    if (printers && printers.length > 0) {
      // 1. Look for Thermal / POS printer
      const thermal = printers.find(p => /pos|thermal|receipt|80|peripage|epson|star|citizen|bixolon|xprinter|tvs/i.test(p.name));
      if (thermal) {
        savePrinterSettings({ defaultPrinterName: thermal.name });
        return thermal.name;
      }
      // 2. Look for System Default printer
      const sysDefault = printers.find(p => p.isDefault);
      if (sysDefault) {
        savePrinterSettings({ defaultPrinterName: sysDefault.name });
        return sysDefault.name;
      }
      return printers[0].name;
    }
  } catch (e) {
    console.warn('Printer auto-detect error:', e.message);
  }
  return null;
}

async function createWindow() {
  // Set printer settings path after app is ready
  printerSettingsPath = path.join(app.getPath('userData'), 'printer-settings.json');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sree Sai Fillings Cafe - POS & Database Software',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    backgroundColor: '#0F172A',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Notify renderer of first-launch status so it can show the restore banner
    if (isFirstLaunch) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:firstLaunchRestore');
        }
      }, 800); // slight delay to let renderer fully initialize
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App Initialization
app.whenReady().then(async () => {
  try {
    // 1. Initialize SQLite Database & Users Table
    await dbManager.initDatabase();
    await authManager.initUsersTable();
    console.log('Database initialized successfully at:', dbManager.getDbFilePath());

    // 2. Fresh Install Detection: if DB is empty, pull everything from cloud first
    const orderCount = dbManager.queryOne('SELECT COUNT(*) as count FROM orders');
    const custCount  = dbManager.queryOne('SELECT COUNT(*) as count FROM customers');
    const isEmpty = (orderCount?.count || 0) === 0 && (custCount?.count || 0) === 0;

    if (isEmpty && supabaseSync.isReady()) {
      console.log('Fresh install detected — pulling all data from Supabase cloud...');
      isFirstLaunch = true;
      try {
        await supabaseSync.pullFromCloud(dbManager, queries);
        console.log('First-launch cloud restore complete.');
      } catch (restoreErr) {
        console.warn('First-launch cloud restore notice:', restoreErr.message);
      }
    }

    // 3. Initial Excel Sync
    excelSync.syncExcelWorkbook().catch(err => {
      console.warn('Initial Excel sync warning:', err.message);
    });

    // 4. Continuous Background Sync: Multi-PC Cloud Sync & Local Excel Sync
    const runBackgroundSync = async () => {
      // 1. Cloud Supabase Sync: push pending local records & pull cloud records from other PCs
      try {
        if (supabaseSync.isReady()) {
          const cats = queries.getAllCategories();
          const items = queries.getAllMenuItems();
          await supabaseSync.syncMenu(cats, items);
          await supabaseSync.fullSync(dbManager, queries);
        }
      } catch (cloudErr) {
        // Silent background notice for offline state
      }

      // 2. Local Excel Sync: guarantees Excel matches SQLite (including newly pulled cloud orders)
      try {
        await excelSync.syncExcelWorkbook();
      } catch (excelErr) {
        console.warn('Background Excel sync notice:', excelErr.message);
      }

      // 3. Google Sheets Live Sync: mirrors all data to Google Sheets in real-time
      try {
        if (googleSheetsSync.isReady()) {
          const dataset = queries.getFullExcelDataset();
          await googleSheetsSync.syncFullData(dataset);
        }
      } catch (gsErr) {
        // Silent background notice for offline state
      }
    };

    // Initial sync shortly after startup (1 second)
    setTimeout(runBackgroundSync, 1000);

    // Continuous background sync loop every 15 seconds for rapid remote updates
    setInterval(runBackgroundSync, 15000);

    // 5. Register IPC Handlers
    registerIpcHandlers();

    // 6. Create Main Window
    createWindow();
  } catch (err) {
    console.error('Fatal initialization error:', err);
    dialog.showErrorBox('Initialization Error', `Failed to start Fillings POS: ${err.message}`);
  }
});

app.on('window-all-closed', () => {
  // Always save DB state before exiting
  dbManager.saveDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function registerIpcHandlers() {
  // App Info & System
  ipcMain.handle('app:getInfo', async () => {
    return {
      name: 'Sree Sai Fillings Cafe POS',
      version: '1.0.0',
      dataDir: dbManager.getDataDirectory(),
      dbPath: dbManager.getDbFilePath(),
      excelPath: excelSync.getExcelFilePath(),
      backupsDir: backupManager.getBackupsDirectory()
    };
  });

  ipcMain.handle('app:isFirstLaunch', async () => {
    return { isFirstLaunch };
  });

  ipcMain.handle('system:openDataFolder', async () => {
    return shell.openPath(dbManager.getDataDirectory());
  });

  ipcMain.handle('system:openExcelFile', async () => {
    try {
      await excelSync.syncExcelWorkbook();
    } catch (e) {}
    return shell.openPath(excelSync.getExcelFilePath());
  });

  ipcMain.handle('system:printReceipt', async (event, options) => {
    const printerName = await resolvePrinterName(options.printerName);
    const view = options.view || 'both';

    // 1. If order object is passed, use Native ESC/POS driver directly (fast, pitch-black, auto-cut 2 bills)
    if (options.order && printerName && process.platform === 'win32') {
      try {
        const escResult = await escposPrinter.printOrderEscpos(printerName, options.order, view, {
          itemsToPrint: options.itemsToPrint,
          subtitle: options.subtitle
        });
        if (escResult && escResult.success) {
          return { success: true, printerName };
        }
      } catch (err) {
        console.warn('ESC/POS print failed, falling back to silent HTML print:', err);
      }
    }

    if (!mainWindow) return { success: false, message: 'Window not active' };
    
    const printWin = new BrowserWindow({
      width: 380,
      height: 700,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @page { margin: 0; size: 80mm auto; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            font-size: 12.5px; 
            line-height: 1.35;
            margin: 0; 
            padding: 6px 8px; 
            color: #000000 !important;
            background: #ffffff !important;
            width: 72mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          
          .receipt-header { text-align: center; margin-bottom: 8px; }
          .receipt-brand-title { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #000; }
          .receipt-brand-tagline { font-size: 10px; margin-top: 2px; color: #000; }
          .receipt-brand-address { font-size: 10px; margin-top: 3px; line-height: 1.25; color: #000; }
          .receipt-brand-phone { font-size: 11px; font-weight: 700; margin-top: 2px; color: #000; }
          .receipt-divider { border-top: 1.5px dashed #000; margin: 6px 0; }
          .receipt-meta-grid { font-size: 11.5px; display: flex; flex-direction: column; gap: 2px; color: #000; }
          .receipt-meta-row { display: flex; justify-content: space-between; }
          .receipt-items-table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin: 4px 0; color: #000; }
          .receipt-items-table th { border-bottom: 1.5px dashed #000; padding: 3px 0; text-transform: uppercase; font-size: 10px; }
          .receipt-items-table td { padding: 3px 0; }
          .receipt-calc-table { font-size: 11.5px; margin-top: 3px; color: #000; }
          .receipt-calc-row { display: flex; justify-content: space-between; padding: 1.5px 0; }
          .receipt-calc-row.total { font-size: 14px; font-weight: 900; border-top: 1.5px dashed #000; border-bottom: 1.5px dashed #000; padding: 5px 0; margin: 3px 0; color: #000; }
          .receipt-footer { text-align: center; font-size: 10px; margin-top: 8px; line-height: 1.35; color: #000; }

          /* Kitchen Order Ticket (Chef Slip) */
          .kot-slip { padding-top: 4px; }
          .kot-title { font-size: 15px; font-weight: 900; letter-spacing: 1px; text-align: center; color: #000; }
          .kot-subtitle { font-size: 11px; font-weight: 700; text-align: center; margin-top: 1px; color: #000; }
          .kot-badge { display: inline-block; background: #000; color: #fff !important; font-weight: 900; font-size: 11px; padding: 2px 7px; border-radius: 3px; }
          .kot-items-table { width: 100%; border-collapse: collapse; margin: 6px 0; color: #000; }
          .kot-items-table th { border-bottom: 2px solid #000; padding: 4px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; }
          .kot-items-table td { padding: 3px 0; font-size: 12px; border-bottom: 1px dashed #999; }
          .kot-qty { font-size: 14px; font-weight: 900; text-align: center; color: #000; }
          .kot-name { font-weight: 700; }

          .receipt-tear-divider {
            page-break-after: always;
            break-after: page;
            border-top: 1.5px dashed #000;
            border-bottom: 1.5px dashed #000;
            margin: 12px 0 10px 0;
            text-align: center;
            font-size: 10px;
            font-weight: 900;
            padding: 4px 0;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        ${options.html || ''}
      </body>
      </html>
    `;

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    await printWin.webContents.executeJavaScript('new Promise(r => setTimeout(r, 200))');
    try { await printWin.webContents.capturePage(); } catch (e) {}

    return new Promise((resolve) => {
      let isDone = false;
      const timeoutTimer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          try { printWin.close(); } catch (e) {}
          resolve({ success: false, message: 'Print job timed out' });
        }
      }, 10000);

      printWin.webContents.print({
        silent: true,
        printBackground: true,
        margins: { marginType: 'none' },
        copies: 1,
        pageSize: { width: 80000, height: 250000 },
        ...(printerName ? { deviceName: printerName } : {})
      }, (success, failureReason) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutTimer);
          try { printWin.close(); } catch (e) {}
          if (!success) {
            resolve({ success: false, message: failureReason });
          } else {
            resolve({ success: true, printerName });
          }
        }
      });
    });
  });

  // Direct Silent Print — sends straight to default printer in 1 click, no dialog
  // Used for single-click "Save & Print Bill" from POS and Receipt modal
  ipcMain.handle('system:directPrint', async (event, options) => {
    const printerName = await resolvePrinterName(options.printerName);
    const view = options.view || 'both';

    // 1. If order object is passed, use the Native ESC/POS driver directly (fast, pitch-black, auto-cut 2 bills)
    if (options.order && printerName && process.platform === 'win32') {
      try {
        const escResult = await escposPrinter.printOrderEscpos(printerName, options.order, view, {
          itemsToPrint: options.itemsToPrint,
          subtitle: options.subtitle
        });
        if (escResult && escResult.success) {
          return { success: true, printerName };
        }
      } catch (err) {
        console.warn('ESC/POS direct print failed, falling back to silent HTML print:', err);
      }
    }

    if (!mainWindow) return { success: false, message: 'Window not active' };

    const printWin = new BrowserWindow({
      width: 380,
      height: 700,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @page { margin: 0; size: 80mm auto; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            font-size: 12.5px; 
            line-height: 1.35;
            margin: 0; 
            padding: 6px 8px; 
            color: #000000 !important;
            background: #ffffff !important;
            width: 72mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .receipt-header { text-align: center; margin-bottom: 8px; }
          .receipt-brand-title { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #000; }
          .receipt-brand-tagline { font-size: 10px; margin-top: 2px; color: #000; }
          .receipt-brand-address { font-size: 10px; margin-top: 3px; line-height: 1.25; color: #000; }
          .receipt-brand-phone { font-size: 11px; font-weight: 700; margin-top: 2px; color: #000; }
          .receipt-divider { border-top: 1.5px dashed #000; margin: 6px 0; }
          .receipt-meta-grid { font-size: 11.5px; display: flex; flex-direction: column; gap: 2px; color: #000; }
          .receipt-meta-row { display: flex; justify-content: space-between; }
          .receipt-items-table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin: 4px 0; color: #000; }
          .receipt-items-table th { border-bottom: 1.5px dashed #000; padding: 3px 0; text-transform: uppercase; font-size: 10px; }
          .receipt-items-table td { padding: 3px 0; }
          .receipt-calc-table { font-size: 11.5px; margin-top: 3px; color: #000; }
          .receipt-calc-row { display: flex; justify-content: space-between; padding: 1.5px 0; }
          .receipt-calc-row.total { font-size: 14px; font-weight: 900; border-top: 1.5px dashed #000; border-bottom: 1.5px dashed #000; padding: 5px 0; margin: 3px 0; color: #000; }
          .receipt-footer { text-align: center; font-size: 10px; margin-top: 8px; line-height: 1.35; color: #000; }
          .kot-slip { padding-top: 4px; }
          .kot-title { font-size: 15px; font-weight: 900; letter-spacing: 1px; text-align: center; color: #000; }
          .kot-subtitle { font-size: 11px; font-weight: 700; text-align: center; margin-top: 1px; color: #000; }
          .kot-badge { display: inline-block; background: #000; color: #fff !important; font-weight: 900; font-size: 11px; padding: 2px 7px; border-radius: 3px; }
          .kot-items-table { width: 100%; border-collapse: collapse; margin: 6px 0; color: #000; }
          .kot-items-table th { border-bottom: 2px solid #000; padding: 4px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; }
          .kot-items-table td { padding: 3px 0; font-size: 12px; border-bottom: 1px dashed #999; }
          .kot-qty { font-size: 14px; font-weight: 900; text-align: center; color: #000; }
          .kot-name { font-weight: 700; }
          .receipt-tear-divider {
            page-break-after: always;
            break-after: page;
            border-top: 1.5px dashed #000;
            border-bottom: 1.5px dashed #000;
            margin: 12px 0 10px 0;
            text-align: center;
            font-size: 10px;
            font-weight: 900;
            padding: 4px 0;
            letter-spacing: 0.5px;
          }
          .customer-slip {}
        </style>
      </head>
      <body>
        ${options.html || ''}
      </body>
      </html>
    `;

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    await printWin.webContents.executeJavaScript('new Promise(r => setTimeout(r, 200))');
    try { await printWin.webContents.capturePage(); } catch (e) {}

    return new Promise((resolve) => {
      let isDone = false;
      const timeoutTimer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          try { printWin.close(); } catch (e) {}
          console.warn('Direct print timed out after 8s');
          resolve({ success: false, message: 'Print job timed out' });
        }
      }, 8000);

      printWin.webContents.print({
        silent: true,
        printBackground: true,
        margins: { marginType: 'none' },
        copies: 1,
        pageSize: { width: 80000, height: 250000 },
        ...(printerName ? { deviceName: printerName } : {})
      }, (success, failureReason) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutTimer);
          try { printWin.close(); } catch (e) {}
          if (!success) {
            console.warn('Direct print failed:', failureReason);
            resolve({ success: false, message: failureReason });
          } else {
            resolve({ success: true, printerName });
          }
        }
      });
    });
  });

  // Printer Management
  ipcMain.handle('printers:getList', async () => {
    if (!mainWindow) return [];
    try {
      // Electron 22+: getPrintersAsync; older: getPrinters
      if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
        return await mainWindow.webContents.getPrintersAsync();
      } else {
        return mainWindow.webContents.getPrinters();
      }
    } catch (e) {
      console.warn('getPrinters error:', e.message);
      return [];
    }
  });

  ipcMain.handle('printers:saveDefault', async (event, printerName) => {
    savePrinterSettings({ defaultPrinterName: printerName });
    return { success: true, printerName };
  });

  ipcMain.handle('printers:getDefault', async () => {
    return getPrinterSettings();
  });

  // Customers
  ipcMain.handle('customers:search', async (event, query, limit) => {
    return queries.searchCustomers(query, limit);
  });

  ipcMain.handle('customers:getAll', async () => {
    return queries.getAllCustomers();
  });

  ipcMain.handle('customers:getById', async (event, id) => {
    return queries.getCustomerById(id);
  });

  ipcMain.handle('customers:getByPhone', async (event, phone) => {
    return queries.getCustomerByPhone(phone);
  });

  ipcMain.handle('customers:createOrUpdate', async (event, data) => {
    const customer = queries.createOrUpdateCustomer(data);
    if (!customer.is_test) {
      try {
        await excelSync.syncExcelWorkbook();
      } catch (err) {
        console.warn('Customer Excel sync notice:', err.message);
      }
      supabaseSync.syncCustomer(customer).catch(err => console.warn(err));
    }
    return customer;
  });

  ipcMain.handle('customers:getOrders', async (event, customerId) => {
    return queries.getOrdersByCustomer(customerId);
  });

  // Menu Management
  ipcMain.handle('menu:getCategories', async () => {
    return queries.getAllCategories();
  });

  ipcMain.handle('menu:getItems', async (event, onlyActive) => {
    return queries.getAllMenuItems(onlyActive);
  });

  ipcMain.handle('menu:addItem', async (event, data) => {
    const item = queries.addMenuItem(data);
    excelSync.syncExcelWorkbook().catch(err => console.warn(err));
    return item;
  });

  ipcMain.handle('menu:updateItem', async (event, id, data) => {
    const item = queries.updateMenuItem(id, data);
    excelSync.syncExcelWorkbook().catch(err => console.warn(err));
    return item;
  });

  ipcMain.handle('menu:toggleStatus', async (event, id) => {
    const res = queries.toggleMenuItemStatus(id);
    excelSync.syncExcelWorkbook().catch(err => console.warn(err));
    return res;
  });

  ipcMain.handle('menu:deleteItem', async (event, id) => {
    const res = queries.deleteMenuItem(id);
    excelSync.syncExcelWorkbook().catch(err => console.warn(err));
    return res;
  });

  // Orders & Billing
  ipcMain.handle('orders:getNextNumber', async () => {
    return queries.getNextOrderNumber();
  });

  ipcMain.handle('orders:save', async (event, payload) => {
    const order = queries.saveOrder(payload);
    // For test orders: skip all persistence side effects
    if (!order.is_test) {
      // 1. Immediately update local Excel workbook and mirror to OneDrive
      try {
        await excelSync.syncExcelWorkbook();
      } catch (err) {
        console.warn('Post-order Excel sync warning:', err.message);
      }
      // 2. Immediately sync order to Supabase Cloud for remote monitoring
      try {
        await supabaseSync.syncOrder(order, payload.items || order.items);
      } catch (err) {
        console.warn('Post-order Supabase sync notice:', err.message);
      }
      // 3. Immediately sync order to Google Sheets live document
      if (googleSheetsSync.isReady()) {
        googleSheetsSync.syncOrder(order, payload.items || order.items).catch(err => {
          console.warn('Post-order Google Sheets sync notice:', err.message);
        });
      }
    }
    return order;
  });

  ipcMain.handle('orders:getDetails', async (event, idOrNumber) => {
    return queries.getOrderDetails(idOrNumber);
  });

  ipcMain.handle('orders:getRecent', async (event, limit) => {
    return queries.getRecentOrders(limit);
  });

  ipcMain.handle('orders:getOpen', async () => {
    return queries.getOpenOrders();
  });

  ipcMain.handle('orders:appendItems', async (event, orderId, newItems, options) => {
    const result = queries.appendItemsToOrder(orderId, newItems, options);
    try {
      const order = queries.getOrderDetails(orderId);
      if (order && !order.is_test) {
        await excelSync.syncExcelWorkbook();
        await supabaseSync.syncOrder(order, order.items);
        if (googleSheetsSync.isReady()) {
          googleSheetsSync.syncOrder(order, order.items).catch(err => {
            console.warn('Post-appendItems Google Sheets sync notice:', err.message);
          });
        }
      }
    } catch (err) {
      console.warn('Post-appendItems sync notice:', err.message);
    }
    return result;
  });

  ipcMain.handle('orders:settle', async (event, orderId, paymentData) => {
    const order = queries.settleOrder(orderId, paymentData);
    if (!order.is_test) {
      try {
        await excelSync.syncExcelWorkbook();
      } catch (err) {
        console.warn('Post-settle Excel sync warning:', err.message);
      }
      try {
        await supabaseSync.syncOrder(order, order.items);
      } catch (err) {
        console.warn('Post-settle Supabase sync notice:', err.message);
      }
      if (googleSheetsSync.isReady()) {
        googleSheetsSync.syncOrder(order, order.items).catch(err => {
          console.warn('Post-settle Google Sheets sync notice:', err.message);
        });
      }
    }
    return order;
  });

  ipcMain.handle('orders:cancel', async (event, orderId, reason) => {
    const order = queries.cancelOrder(orderId, reason);
    try {
      await excelSync.rebuildExcelWorkbook();
      if (order && !order.is_test) {
        await supabaseSync.syncOrder(order, order.items);
        if (googleSheetsSync.isReady()) {
          googleSheetsSync.syncFullData(queries.getFullExcelDataset()).catch(err => {
            console.warn('Post-cancel Google Sheets sync notice:', err.message);
          });
        }
      }
    } catch (err) {
      console.warn('Post-cancel sync warning:', err.message);
    }
    return order;
  });

  ipcMain.handle('orders:delete', async (event, orderIdOrNumber) => {
    const order = queries.getOrderDetails(orderIdOrNumber);
    if (!order) {
      return { success: false, message: 'Order not found' };
    }
    const delResult = queries.deleteOrder(orderIdOrNumber);
    if (!order.is_test) {
      supabaseSync.deleteOrder(order.order_number).catch(err => {
        console.warn('Supabase order delete error:', err.message);
      });
      try {
        await excelSync.rebuildExcelWorkbook();
      } catch (err) {
        console.warn('Excel post-delete rebuild notice:', err.message);
      }
    }
    return { success: true, order };
  });

  // Dashboard & Reports
  ipcMain.handle('dashboard:getSummary', async () => {
    return queries.getDashboardSummary();
  });

  ipcMain.handle('reports:getDaily', async (event, limitDays) => {
    return queries.getDailySales(limitDays);
  });

  ipcMain.handle('reports:getMonthly', async () => {
    return queries.getMonthlySales();
  });

  ipcMain.handle('reports:getDateRange', async (event, fromDate, toDate) => {
    return queries.getDateRangeReport(fromDate, toDate);
  });

  ipcMain.handle('reports:getTopItems', async (event, limit) => {
    return queries.getTopSellingItems(limit);
  });

  // Excel Synchronization & Export
  ipcMain.handle('excel:sync', async () => {
    return excelSync.syncExcelWorkbook();
  });

  ipcMain.handle('excel:getStatus', async () => {
    return excelSync.getSyncStatus();
  });

  ipcMain.handle('excel:export', async () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const defaultFilename = `Fillings_Cafe_Data_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.xlsx`;

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Business Data to Excel',
      defaultPath: defaultFilename,
      filters: [{ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) {
      return { success: false, message: 'Export cancelled by user.' };
    }

    return excelSync.exportExcelToCustomPath(filePath);
  });

  // Backup & Restore
  ipcMain.handle('backup:create', async () => {
    return backupManager.createBackup();
  });

  ipcMain.handle('backup:list', async () => {
    return backupManager.listBackups();
  });

  ipcMain.handle('backup:restore', async (event, backupPath) => {
    return backupManager.restoreBackup(backupPath);
  });

  ipcMain.handle('backup:selectAndRestore', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Backup Database to Restore',
      filters: [{ name: 'SQLite Database (*.db)', extensions: ['db'] }],
      properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, message: 'Restore cancelled.' };
    }

    return backupManager.restoreBackup(filePaths[0]);
  });

  // Supabase Cloud Sync Status
  ipcMain.handle('supabase:getStatus', async () => {
    return supabaseSync.checkConnection();
  });

  // Authentication & Session Management
  ipcMain.handle('auth:login', async (event, username, password, rememberMe) => {
    return authManager.login(username, password, rememberMe);
  });

  ipcMain.handle('auth:logout', async () => {
    return authManager.logout();
  });

  ipcMain.handle('auth:checkSession', async () => {
    return authManager.checkSession();
  });

  ipcMain.handle('cloud:pullSync', async () => {
    const res = await supabaseSync.pullFromCloud(dbManager, queries);
    if (res.success) {
      try {
        await excelSync.syncExcelWorkbook();
      } catch (e) {}
    }
    return res;
  });

  ipcMain.handle('cloud:fullSync', async () => {
    const res = await supabaseSync.fullSync(dbManager, queries);
    if (res.success) {
      try {
        await excelSync.syncExcelWorkbook();
      } catch (e) {}
    }
    return res;
  });

  ipcMain.handle('cloud:updateOfflineData', async () => {
    const res = await supabaseSync.updateCloudData(dbManager, queries);
    if (res.success) {
      try {
        await excelSync.syncExcelWorkbook();
      } catch (e) {}
    }
    return res;
  });

  ipcMain.handle('cloud:getPendingCount', async () => {
    return supabaseSync.getPendingOfflineCount(dbManager);
  });

  // Expenses & Purchases
  ipcMain.handle('expenses:add', async (event, data) => {
    const expense = queries.addExpense(data);
    try {
      await excelSync.syncExcelWorkbook();
    } catch (err) {
      console.warn('Post-expense Excel sync notice:', err.message);
    }
    supabaseSync.syncExpense(expense).catch(err => console.warn(err));
    if (googleSheetsSync.isReady()) {
      googleSheetsSync.syncExpense(expense).catch(err => {
        console.warn('Post-expense Google Sheets sync notice:', err.message);
      });
    }
    return expense;
  });

  ipcMain.handle('expenses:getAll', async (event, filters) => {
    return queries.getAllExpenses(filters);
  });

  ipcMain.handle('expenses:delete', async (event, id) => {
    const res = queries.deleteExpense(id);
    try {
      await excelSync.rebuildExcelWorkbook();
    } catch (err) {
      console.warn('Post-expense delete Excel rebuild notice:', err.message);
    }
    if (googleSheetsSync.isReady()) {
      googleSheetsSync.syncFullData(queries.getFullExcelDataset()).catch(err => {
        console.warn('Post-delete expense Google Sheets sync notice:', err.message);
      });
    }
    return res;
  });

  ipcMain.handle('expenses:getSummary', async () => {
    return queries.getExpenseSummary();
  });

  ipcMain.handle('expenses:getProfitSummary', async () => {
    return queries.getProfitSummary();
  });

  // Google Sheets Live Real-Time Sync
  ipcMain.handle('googleSheets:getStatus', async () => {
    return googleSheetsSync.getStatus();
  });

  ipcMain.handle('googleSheets:saveConfig', async (event, newConfig) => {
    return googleSheetsSync.saveConfig(newConfig);
  });

  ipcMain.handle('googleSheets:testConnection', async () => {
    return googleSheetsSync.testConnection();
  });

  ipcMain.handle('googleSheets:syncNow', async () => {
    const dataset = queries.getFullExcelDataset();
    return googleSheetsSync.syncFullData(dataset);
  });

  ipcMain.handle('googleSheets:openSheet', async () => {
    const cfg = googleSheetsSync.getConfig();
    if (cfg && cfg.sheetUrl) {
      shell.openExternal(cfg.sheetUrl);
      return { success: true };
    }
    return { success: false, message: 'Google Sheet URL not configured' };
  });
}
