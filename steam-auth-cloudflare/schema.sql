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

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_steam_id TEXT NOT NULL,
  target_steam_id TEXT NOT NULL,
  action TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_tickets_expires ON login_tickets(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_steam_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_steam_id);


CREATE TABLE IF NOT EXISTS role_settings (
  role_key TEXT PRIMARY KEY,
  rank INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  role_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
