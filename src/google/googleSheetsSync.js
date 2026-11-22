// Sree Sai Fillings Cafe - Google Sheets Live Real-Time Sync Engine
// Connects POS on Windows 7/10/11 to Google Sheets via Apps Script Web App Webhook

// Polyfill fetch for Node/Electron 22 main process if needed
let fetchFn = globalThis.fetch;
if (typeof fetchFn === 'undefined') {
  try {
    fetchFn = require('cross-fetch');
  } catch (e) {
    console.warn('Cross-fetch polyfill warning:', e.message);
  }
}

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { isTestCustomerName } = require('../database/queries');

let config = {
  webAppUrl: '',
  sheetUrl: '',
  enabled: true,
  lastSync: null,
  lastStatus: 'Not configured'
};

const CONFIG_PATHS = [
  path.join(process.env.APPDATA || '', 'FillingsDatabaseSoftware/googleSheetsConfig.json'),
  path.join(__dirname, '../config/googleSheetsConfig.json'),
  path.join(process.cwd(), 'src/config/googleSheetsConfig.json')
];

/**
 * Load Google Sheets configuration from disk
 */
function loadConfig() {
  for (const cp of CONFIG_PATHS) {
    if (fs.existsSync(cp)) {
      try {
        const data = JSON.parse(fs.readFileSync(cp, 'utf8'));
        if (data && typeof data === 'object') {
          config = Object.assign(config, data);
          return config;
        }
      } catch (err) {}
    }
  }
  return config;
}

loadConfig();

/**
 * Save updated configuration to disk
 */
function saveConfig(newConfig) {
  config = Object.assign(config, newConfig);
  const primaryPath = CONFIG_PATHS[0];
  try {
    const dir = path.dirname(primaryPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(primaryPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}

  // Also update project config if writable
  try {
    fs.writeFileSync(CONFIG_PATHS[1], JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}

  return config;
}

/**
 * Robust HTTP POST with automatic Google 302 redirect following
 */
function postWithRedirect(targetUrl, payload, timeoutMs = 45000, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects while contacting Google Sheets'));
    }

    try {
      const urlObj = new URL(targetUrl);
      const postData = JSON.stringify(payload);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FillingsCafePOS'
        },
        timeout: timeoutMs
      };

      const req = https.request(options, (res) => {
        // Handle Google Apps Script 302/301 redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location;
          // Google redirects to an echo URL via GET
          const redirReq = https.get(redirectUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FillingsCafePOS' },
            timeout: timeoutMs
          }, (redirectRes) => {
            let body = '';
            redirectRes.on('data', chunk => { body += chunk; });
            redirectRes.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                resolve(parsed);
              } catch (parseErr) {
                resolve({ success: true, raw: body });
              }
            });
          });

          redirReq.on('error', reject);
          redirReq.on('timeout', () => {
            redirReq.destroy();
            reject(new Error('Google Sheets redirect GET timed out'));
          });
          return;
        }

        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            resolve({ success: res.statusCode === 200, raw: data });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Google Sheets request timed out'));
      });

      req.write(postData);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Send payload to Google Apps Script Web App
 */
async function sendToGoogleSheets(payload) {
  if (!config.webAppUrl || !config.enabled) {
    return { success: false, message: 'Google Sheets sync not enabled or URL missing' };
  }

  return postWithRedirect(config.webAppUrl, payload, 45000);
}

const GoogleSheetsSync = {
  isReady() {
    if (process.env.NODE_ENV === 'test') return false;
    return !!(config.webAppUrl && config.enabled && config.webAppUrl.startsWith('https://script.google.com'));
  },

  getConfig() {
    return { ...config };
  },

  saveConfig(newConfig) {
    return saveConfig(newConfig);
  },

  /**
   * Test connection to Google Sheets Web App
   */
  async testConnection() {
    if (!config.webAppUrl) {
      return { success: false, message: 'Google Sheets Web App URL is empty' };
    }
    try {
      const res = await sendToGoogleSheets({ action: 'PING' });
      if (res && res.success) {
        config.lastStatus = 'Connected';
        config.lastSync = new Date().toISOString();
        saveConfig(config);
        return { success: true, message: 'Connected to Google Sheets successfully!' };
      }
      return { success: false, message: (res && res.message) || 'Unexpected response from Google' };
    } catch (err) {
      return { success: false, message: `Could not connect: ${err.message}` };
    }
  },

  /**
   * Sync a single order and its items in real time
   */
  async syncOrder(order, items = []) {
    if (!this.isReady() || !order || !order.order_number) return;
    if (order.is_test || isTestCustomerName(order.customer_name) || order.order_number === 'TEST-ORD') return;

    try {
      const res = await sendToGoogleSheets({
        action: 'SYNC_ORDER',
        order,
        items
      });
      if (res && res.success) {
        config.lastSync = new Date().toISOString();
        config.lastStatus = 'Active';
      }
      return res;
    } catch (err) {
      console.warn('Google Sheets order sync notice (offline):', err.message);
      return { success: false, offline: true, error: err.message };
    }
  },

  /**
   * Sync a single expense in real time
   */
  async syncExpense(expense) {
    if (!this.isReady() || !expense || !expense.item_name) return;

    try {
      const res = await sendToGoogleSheets({
        action: 'SYNC_EXPENSE',
        expense
      });
      if (res && res.success) {
        config.lastSync = new Date().toISOString();
      }
      return res;
    } catch (err) {
      console.warn('Google Sheets expense sync notice (offline):', err.message);
      return { success: false, offline: true, error: err.message };
    }
  },

  /**
   * Full snapshot synchronization: pushes complete database across all 7 sheets
   */
  async syncFullData(dataset, reset = false) {
    if (!this.isReady() || !dataset) return { success: false, message: 'Google Sheets not configured or no dataset' };

    try {
      const res = await sendToGoogleSheets({
        action: reset ? 'RESET_AND_SYNC' : 'FULL_SYNC',
        dataset,
        reset
      });
      if (res && res.success) {
        config.lastSync = new Date().toISOString();
        config.lastStatus = 'Synced';
        saveConfig(config);
      }
      return res;
    } catch (err) {
      console.warn('Google Sheets full sync notice (offline):', err.message);
      return { success: false, offline: true, error: err.message };
    }
  },

  getStatus() {
    return {
      ready: this.isReady(),
      enabled: config.enabled,
      webAppUrl: config.webAppUrl,
      sheetUrl: config.sheetUrl,
      lastSync: config.lastSync,
      lastStatus: config.lastStatus
    };
  }
};

module.exports = GoogleSheetsSync;
