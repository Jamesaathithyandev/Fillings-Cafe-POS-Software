// Sree Sai Fillings Cafe - Database Manager
// SQLite engine using sql.js with disk persistence

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const initialMenu = require('./initialMenu');

let db = null;
let dbFilePath = null;
let dataDirPath = null;

/**
 * Configure data directory path
 */
function getDataDirectory() {
  if (dataDirPath) return dataDirPath;

  // Prefer standard Windows AppData folder or local fallback
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
  const targetDir = path.join(appData, 'FillingsDatabaseSoftware');
  
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
      // Fallback to project directory ./data
      const localDataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(localDataDir)) {
        fs.mkdirSync(localDataDir, { recursive: true });
      }
      dataDirPath = localDataDir;
      return localDataDir;
    }
  }

  // Also ensure local backup/export subdirectories exist
  const backupsDir = path.join(targetDir, 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  const exportsDir = path.join(targetDir, 'exports');
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

  dataDirPath = targetDir;
  return targetDir;
}

/**
 * Get the path to the primary SQLite database file
 */
function getDbFilePath() {
  if (dbFilePath) return dbFilePath;
  const dir = getDataDirectory();
  dbFilePath = path.join(dir, 'fillings_pos.db');
  return dbFilePath;
}

/**
 * Initialize and open SQLite database
 */
async function initDatabase(customPath = null) {
  const SQL = await initSqlJs();
  const filePath = customPath || getDbFilePath();

  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    saveDatabase();
  }

  // Load and execute schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.run(schemaSql);
  saveDatabase();

  // Pre-seed initial menu data if empty
  seedInitialData();

  return db;
}

/**
 * Persist in-memory database to disk
 */
function saveDatabase() {
  if (!db) return;
  const filePath = getDbFilePath();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(filePath, buffer);
}

/**
 * Seed initial categories & menu items from initialMenu.js if table is empty
 */
function seedInitialData() {
  const countRes = queryOne("SELECT COUNT(*) as count FROM menu_items");
  if (countRes && countRes.count > 0) {
    return; // Already seeded
  }

  console.log('Pre-seeding Sree Sai Fillings Cafe menu items...');

  // Seed Categories
  const categoryMap = {};
  for (const cat of initialMenu.categories) {
    db.run("INSERT OR IGNORE INTO categories (name, display_order, icon, is_active) VALUES (?, ?, ?, 1)", [
      cat.name,
      cat.display_order,
      cat.icon
    ]);
  }

  // Fetch category IDs
  const categories = queryAll("SELECT id, name FROM categories");
  categories.forEach(c => { categoryMap[c.name] = c.id; });

  // Seed Menu Items
  const now = new Date().toISOString();
  for (const item of initialMenu.items) {
    const catId = categoryMap[item.category] || 1;
    db.run(
      `INSERT OR IGNORE INTO menu_items (item_code, category_id, category_name, name, price, description, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [item.code, catId, item.category, item.name, item.price, item.desc || '', now, now]
    );
  }

  saveDatabase();
  console.log(`Pre-seeded ${initialMenu.items.length} menu items successfully.`);
}

/**
 * Helper: Query multiple rows returning array of JS objects
 */
function queryAll(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Helper: Query single row returning JS object or null
 */
function queryOne(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

/**
 * Helper: Run an INSERT/UPDATE/DELETE statement and persist to disk
 */
function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  
  // Get last inserted ID and rows modified BEFORE export/saveDatabase
  let lastInsertRowid = 0;
  let changes = 0;
  try {
    const res = db.exec("SELECT last_insert_rowid(), changes()");
    if (res && res.length > 0 && res[0].values && res[0].values.length > 0) {
      lastInsertRowid = res[0].values[0][0];
      changes = res[0].values[0][1];
    }
  } catch (e) {
    console.warn('last_insert_rowid error:', e);
  }

  saveDatabase();
  
  return {
    lastInsertRowid,
    changes
  };
}

/**
 * Export raw binary buffer of database for backup
 */
function exportDatabaseBuffer() {
  if (!db) throw new Error('Database not initialized');
  return Buffer.from(db.export());
}

/**
 * Replace active database with a restored binary buffer
 */
async function restoreDatabaseFromBuffer(buffer) {
  const SQL = await initSqlJs();
  db = new SQL.Database(buffer);
  saveDatabase();
  return true;
}

module.exports = {
  initDatabase,
  getDataDirectory,
  getDbFilePath,
  saveDatabase,
  queryAll,
  queryOne,
  run,
  exportDatabaseBuffer,
  restoreDatabaseFromBuffer
};
