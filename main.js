// Sree Sai Fillings Cafe - Electron Main Process
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    globalThis.WebSocket = require('ws');
  } catch (e) {}
}

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const dbManager = require('./src/database/db');
const queries = require('./src/database/queries');
const excelSync = require('./src/excel/excelSync');
const backupManager = require('./src/backup/backupManager');
const supabaseSync = require('./src/supabase/supabaseSync');
const authManager = require('./src/auth/authManager');

let mainWindow = null;

async function createWindow() {
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

    // 2. Initial Excel Sync
    excelSync.syncExcelWorkbook().catch(err => {
      console.warn('Initial Excel sync warning:', err.message);
    });

    // 3. Background Supabase Sync & Multi-PC Cloud Pull
    setTimeout(async () => {
      try {
        const cats = queries.getAllCategories();
        const items = queries.getAllMenuItems();
        await supabaseSync.syncMenu(cats, items);
        // Pull down any orders or customers recorded on another PC
        await supabaseSync.pullFromCloud(dbManager, queries);
        excelSync.syncExcelWorkbook().catch(() => {});
      } catch (e) {
        console.warn('Supabase initial sync notice:', e.message);
      }
    }, 3000);

    // 4. Register IPC Handlers
    registerIpcHandlers();

    // 5. Create Main Window
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

  ipcMain.handle('system:openDataFolder', async () => {
    return shell.openPath(dbManager.getDataDirectory());
  });

  ipcMain.handle('system:openExcelFile', async () => {
    return shell.openPath(excelSync.getExcelFilePath());
  });

  ipcMain.handle('system:printReceipt', async (event, options) => {
    if (!mainWindow) return { success: false, message: 'Window not active' };
    
    // Create print preview / print
    const printWin = new BrowserWindow({
      width: 400,
      height: 600,
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
          @page { size: 80mm auto; margin: 0; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            font-size: 12px; 
            margin: 4mm; 
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          
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

          /* Kitchen Order Ticket (Chef Slip) */
          .kot-slip { padding-top: 6px; }
          .kot-title { font-size: 16px; font-weight: 900; letter-spacing: 1px; text-align: center; }
          .kot-subtitle { font-size: 11px; font-weight: 700; text-align: center; margin-top: 2px; }
          .kot-badge { display: inline-block; background: #000; color: #fff; font-weight: 900; font-size: 12px; padding: 2px 8px; border-radius: 3px; margin-top: 2px; }
          .kot-items-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .kot-items-table th { border-bottom: 2px solid #000; padding: 5px 0; font-size: 11.5px; font-weight: 900; text-transform: uppercase; }
          .kot-items-table td { padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #ccc; }
          .kot-qty { font-size: 15px; font-weight: 900; text-align: center; color: #000; }
          .kot-name { font-weight: 700; }

          /* Tear Divider: completely invisible on printed paper with auto-cut page-break */
          .receipt-tear-divider {
            page-break-after: always;
            break-after: page;
            height: 12mm;
            overflow: hidden;
            visibility: hidden;
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        ${options.html || ''}
      </body>
      </html>
    `;

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    return new Promise((resolve) => {
      printWin.webContents.print({
        silent: false,
        printBackground: true,
        margins: { marginType: 'none' }
      }, (success, failureReason) => {
        printWin.close();
        if (!success) {
          resolve({ success: false, message: failureReason });
        } else {
          resolve({ success: true });
        }
      });
    });
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
    // Background Excel & Cloud Sync
    excelSync.syncExcelWorkbook().catch(err => console.warn(err));
    supabaseSync.syncCustomer(customer).catch(err => console.warn(err));
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
    // Automatically trigger Excel sync in background
    excelSync.syncExcelWorkbook().catch(err => {
      console.warn('Post-order Excel sync warning:', err.message);
    });
    // Cloud sync to Supabase in background
    supabaseSync.syncOrder(order, payload.items).catch(err => {
      console.warn('Post-order Supabase sync notice:', err.message);
    });
    return order;
  });

  ipcMain.handle('orders:getDetails', async (event, idOrNumber) => {
    return queries.getOrderDetails(idOrNumber);
  });

  ipcMain.handle('orders:getRecent', async (event, limit) => {
    return queries.getRecentOrders(limit);
  });

  ipcMain.handle('orders:cancel', async (event, orderId, reason) => {
    const order = queries.cancelOrder(orderId, reason);
    excelSync.syncExcelWorkbook().catch(err => console.warn(err));
    return order;
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
      excelSync.syncExcelWorkbook().catch(() => {});
    }
    return res;
  });
}
