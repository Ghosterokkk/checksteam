CREATE TABLE IF NOT EXISTS users (
  steam_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT 'Без отдела',
  privilege TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_tickets (
  ticket_hash TEXT PRIMARY KEY,
  steam_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  steam_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_tickets_expires ON login_tickets(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
