// Sree Sai Fillings Cafe - Electron Main Process
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const dbManager = require('./src/database/db');
const queries = require('./src/database/queries');
const excelSync = require('./src/excel/excelSync');
const backupManager = require('./src/backup/backupManager');

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
    // 1. Initialize SQLite Database
    await dbManager.initDatabase();
    console.log('Database initialized successfully at:', dbManager.getDbFilePath());

    // 2. Initial Excel Sync
    excelSync.syncExcelWorkbook().catch(err => {
      console.warn('Initial Excel sync warning:', err.message);
    });

    // 3. Register IPC Handlers
    registerIpcHandlers();

    // 4. Create Main Window
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
            margin: 5mm; 
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .table { width: 100%; border-collapse: collapse; margin: 6px 0; }
          .table th, .table td { padding: 3px 0; }
          .title { font-size: 15px; font-weight: bold; }
          .subtitle { font-size: 11px; }
          .summary-row { display: flex; justify-content: space-between; padding: 2px 0; }
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
    // Background Excel Sync
    excelSync.syncExcelWorkbook().catch(err => console.warn(err));
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
}
