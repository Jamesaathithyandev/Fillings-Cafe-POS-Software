// Sree Sai Fillings Cafe - Backup & Restore Manager

const fs = require('fs');
const path = require('path');
const dbManager = require('../database/db');
const excelSync = require('../excel/excelSync');

function getBackupsDirectory() {
  const dataDir = dbManager.getDataDirectory();
  const backupsDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  return backupsDir;
}

/**
 * Format timestamp for backup filename: YYYY-MM-DD_HH-mm-ss
 */
function getTimestampString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const t = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${d}_${t}`;
}

/**
 * Create a full database backup (.db file) and optionally an Excel snapshot (.xlsx)
 */
async function createBackup(customDir = null) {
  const targetDir = customDir || getBackupsDirectory();
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const timestamp = getTimestampString();
  const dbBackupName = `fillings_backup_${timestamp}.db`;
  const xlsxBackupName = `fillings_data_${timestamp}.xlsx`;

  const dbBackupPath = path.join(targetDir, dbBackupName);
  const xlsxBackupPath = path.join(targetDir, xlsxBackupName);

  // 1. Write SQLite binary backup
  const dbBuffer = dbManager.exportDatabaseBuffer();
  fs.writeFileSync(dbBackupPath, dbBuffer);

  // 2. Write Excel backup
  let excelExportSuccess = false;
  try {
    await excelSync.exportExcelToCustomPath(xlsxBackupPath);
    excelExportSuccess = true;
  } catch (err) {
    console.warn('Excel snapshot failed during backup:', err.message);
  }

  return {
    success: true,
    timestamp,
    dbFile: dbBackupPath,
    xlsxFile: excelExportSuccess ? xlsxBackupPath : null,
    sizeBytes: dbBuffer.length,
    message: `Backup created successfully (${dbBackupName})`
  };
}

/**
 * List all existing backups sorted newest first
 */
function listBackups() {
  const backupsDir = getBackupsDirectory();
  if (!fs.existsSync(backupsDir)) return [];

  const files = fs.readdirSync(backupsDir);
  const backups = [];

  for (const file of files) {
    if (file.endsWith('.db')) {
      const fullPath = path.join(backupsDir, file);
      const stats = fs.statSync(fullPath);
      backups.push({
        filename: file,
        path: fullPath,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString(),
        formattedDate: stats.mtime.toLocaleString()
      });
    }
  }

  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Restore database from a .db backup file
 */
async function restoreBackup(backupFilePath) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error('Backup file does not exist.');
  }

  const buffer = fs.readFileSync(backupFilePath);
  await dbManager.restoreDatabaseFromBuffer(buffer);
  
  // Also resync Excel after restore
  try {
    await excelSync.syncExcelWorkbook();
  } catch (e) {
    console.warn('Post-restore Excel sync warning:', e.message);
  }

  return {
    success: true,
    message: 'Database restored successfully from backup.'
  };
}

module.exports = {
  getBackupsDirectory,
  createBackup,
  listBackups,
  restoreBackup
};
