// Sree Sai Fillings Cafe - Authentication Manager
// Manages user authentication, session persistence, and password security

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dbManager = require('../database/db');
const supabaseSync = require('../supabase/supabaseSync');

// Static salt for password hashing
const SALT = 'fillings_cafe_salt_2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

// Session file path in AppData
function getSessionFilePath() {
  const dataDir = dbManager.getDataDirectory();
  return path.join(dataDir, 'session.json');
}

const AuthManager = {
  // Pre-seeded credentials fallback
  defaultAdmin: {
    username: 'admin',
    passwordHash: hashPassword('Fillings@2026'),
    displayName: 'Sree Sai Fillings Admin',
    role: 'admin'
  },

  /**
   * Initialize app_users table in local SQLite and Supabase
   */
  async initUsersTable() {
    try {
      // Local SQLite
      dbManager.run(`
        CREATE TABLE IF NOT EXISTS app_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT DEFAULT 'admin',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Seed default admin locally if table empty
      const existing = dbManager.queryOne("SELECT COUNT(*) as count FROM app_users WHERE username = 'admin'");
      if (!existing || existing.count === 0) {
        dbManager.run(
          "INSERT INTO app_users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
          ['admin', this.defaultAdmin.passwordHash, this.defaultAdmin.displayName, 'admin']
        );
        dbManager.saveDatabase();
      }

      // Sync users table to Supabase if connected
      if (supabaseSync.isReady()) {
        await supabaseSync.syncAdminUser({
          username: 'admin',
          password_hash: this.defaultAdmin.passwordHash,
          display_name: this.defaultAdmin.displayName,
          role: 'admin'
        });
      }
    } catch (e) {
      console.warn('Init users table notice:', e.message);
    }
  },

  /**
   * Validate session on startup
   */
  checkSession() {
    try {
      const sessionPath = getSessionFilePath();
      if (!fs.existsSync(sessionPath)) return { authenticated: false };

      const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      if (!session || !session.token || !session.user) {
        return { authenticated: false };
      }

      // Verify token expiration (30 days if rememberMe, else 24 hours)
      const now = Date.now();
      if (session.expiresAt && now > session.expiresAt) {
        this.logout();
        return { authenticated: false, message: 'Session expired' };
      }

      return {
        authenticated: true,
        user: session.user,
        rememberMe: Boolean(session.rememberMe)
      };
    } catch (e) {
      return { authenticated: false };
    }
  },

  /**
   * Authenticate user with Username & Password
   */
  async login(username, password, rememberMe = true) {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, message: 'Please enter both username and password.' };
    }

    const hashedInput = hashPassword(cleanPass);
    let matchedUser = null;

    // 1. Try Supabase Cloud verification first (if online)
    if (supabaseSync.isReady()) {
      try {
        const cloudUser = await supabaseSync.fetchUserByUsername(cleanUser);
        if (cloudUser) {
          if (cloudUser.password_hash === hashedInput) {
            matchedUser = {
              id: cloudUser.id,
              username: cloudUser.username,
              displayName: cloudUser.display_name,
              role: cloudUser.role
            };
          } else {
            return { success: false, message: 'Incorrect password. Please try again.' };
          }
        }
      } catch (err) {
        console.warn('Cloud auth failed, falling back to local:', err.message);
      }
    }

    // 2. Fallback to Local SQLite verification
    if (!matchedUser) {
      const localUser = dbManager.queryOne(
        "SELECT * FROM app_users WHERE LOWER(username) = ? AND is_active = 1",
        [cleanUser]
      );

      if (localUser) {
        if (localUser.password_hash === hashedInput) {
          matchedUser = {
            id: localUser.id,
            username: localUser.username,
            displayName: localUser.display_name,
            role: localUser.role
          };
        } else {
          return { success: false, message: 'Incorrect password. Please try again.' };
        }
      } else if (cleanUser === 'admin' && hashedInput === this.defaultAdmin.passwordHash) {
        // Built-in hardcoded fallback
        matchedUser = {
          id: 1,
          username: 'admin',
          displayName: this.defaultAdmin.displayName,
          role: 'admin'
        };
      } else {
        return { success: false, message: 'Username not found.' };
      }
    }

    // 3. Save Session
    try {
      const sessionDuration = rememberMe ? (30 * 24 * 60 * 60 * 1000) : (12 * 60 * 60 * 1000);
      const sessionData = {
        token: crypto.randomBytes(32).toString('hex'),
        user: matchedUser,
        rememberMe,
        createdAt: Date.now(),
        expiresAt: Date.now() + sessionDuration
      };

      fs.writeFileSync(getSessionFilePath(), JSON.stringify(sessionData, null, 2), 'utf8');
      return { success: true, user: matchedUser };
    } catch (e) {
      return { success: true, user: matchedUser }; // Return success even if writing session file had an issue
    }
  },

  /**
   * Log out and delete active session
   */
  logout() {
    try {
      const sessionPath = getSessionFilePath();
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
      }
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
};

module.exports = AuthManager;
