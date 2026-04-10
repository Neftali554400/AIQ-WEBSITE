const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

// Use Railway volume if mounted, otherwise fall back to local data/
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? process.env.RAILWAY_VOLUME_MOUNT_PATH
  : path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'aiq.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT,
    provider      TEXT    NOT NULL DEFAULT 'email',
    picture       TEXT,
    verified      INTEGER NOT NULL DEFAULT 0,
    joined        TEXT    NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    NOT NULL,
    code       TEXT    NOT NULL,
    expires_at INTEGER NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reset_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    token      TEXT    NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    course_id   TEXT    NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    course_id TEXT    NOT NULL,
    amount    INTEGER NOT NULL,
    reference TEXT    NOT NULL,
    paid_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS early_access (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add token_version to existing databases that predate this column
try { db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0'); } catch(e) {}

// Performance indexes — safe to run on every start (IF NOT EXISTS)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
  CREATE INDEX IF NOT EXISTS idx_otp_email_used        ON otp_codes(email, used);
  CREATE INDEX IF NOT EXISTS idx_otp_expires           ON otp_codes(expires_at);
  CREATE INDEX IF NOT EXISTS idx_reset_token_used      ON reset_tokens(token, used);
  CREATE INDEX IF NOT EXISTS idx_reset_user            ON reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_enrollments_user      ON enrollments(user_id);
  CREATE INDEX IF NOT EXISTS idx_payments_user         ON payments(user_id);
`);

module.exports = db;
