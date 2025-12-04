/**
 * Database initialization and setup
 */
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { DB_PATH } from '../config/index.js';

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

/**
 * Initialize database tables and settings
 * This function is called explicitly, but initialization also happens on module load
 */
export function initializeDatabase() {
  // Database initialization happens automatically when module is imported
  // This function exists for explicit initialization if needed
  console.log('[DB] Database initialized');
}

// Initialize tables
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invId TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  amount REAL,
  createdAt INTEGER NOT NULL,
  gender TEXT,
  role TEXT,
  company TEXT,
  photoSessionType TEXT DEFAULT 'Деловая фотосессия',
  hasImageData INTEGER DEFAULT 0,
  generatedImagesJson TEXT,
  failureReason TEXT,
  retries INTEGER DEFAULT 0
);
`);

// Migrations: add new columns
try {
  db.exec(`ALTER TABLE orders ADD COLUMN paymentType TEXT`);
} catch (e) {
  if (!String(e.message || e).includes('duplicate column')) {
    console.error('[DB] Failed to add paymentType column to orders:', e);
  }
}

try {
  db.exec(`ALTER TABLE orders ADD COLUMN promoCode TEXT`);
} catch (e) {
  if (!String(e.message || e).includes('duplicate column')) {
    console.error('[DB] Failed to add promoCode column to orders:', e);
  }
}

try {
  db.exec(`ALTER TABLE orders ADD COLUMN imagesCount INTEGER DEFAULT 0`);
} catch (e) {
  if (!String(e.message || e).includes('duplicate column')) {
    console.error('[DB] Failed to add imagesCount column to orders:', e);
  }
}

// Promo codes table
db.exec(`
CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  maxUses INTEGER NOT NULL,
  usedCount INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  expiresAt INTEGER,
  note TEXT
);
`);

// Admin settings table
db.exec(`
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  passwordHash TEXT NOT NULL,
  salt TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
`);

// Initialize admin password seed
const getAdminSettingsStmt = db.prepare(`SELECT * FROM admin_settings WHERE id = 1`);
const upsertAdminSettingsStmt = db.prepare(`
INSERT INTO admin_settings (id, passwordHash, salt, createdAt, updatedAt)
VALUES (1, @passwordHash, @salt, @createdAt, @updatedAt)
ON CONFLICT(id) DO UPDATE SET
  passwordHash = excluded.passwordHash,
  salt = excluded.salt,
  updatedAt = excluded.updatedAt
;
`);

function ensureAdminPasswordSeed() {
  const existing = getAdminSettingsStmt.get();
  if (existing) {
    return;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync('513277', salt, 64).toString('hex');
  const now = Date.now();
  upsertAdminSettingsStmt.run({
    passwordHash: hash,
    salt,
    createdAt: now,
    updatedAt: now,
  });
  console.log('[Admin] Seeded default admin password (id=1)');
}

ensureAdminPasswordSeed();

export { getAdminSettingsStmt, upsertAdminSettingsStmt };

