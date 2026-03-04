"use strict"
/**
 * migrate.ts - creates tables if they don't exist.
 * Run with:  npm run migrate
 */

require("dotenv").config()
const db = require("./db")

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sites (
  id          TEXT PRIMARY KEY,          -- UUID
  name        TEXT NOT NULL,             -- human label, e.g. "My Shop"
  domain      TEXT NOT NULL,             -- allowed origin, e.g. "https://myshop.com"
  api_key     TEXT NOT NULL UNIQUE,      -- what the site sends in X-Api-Key header
  pixel_id    TEXT NOT NULL,             -- Facebook Pixel / Dataset ID
  fb_token    TEXT NOT NULL,             -- Facebook System User access token
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  note        TEXT
);

CREATE TABLE IF NOT EXISTS event_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       TEXT NOT NULL,
  event_name    TEXT,
  fb_status     INTEGER,
  fb_events_received INTEGER,
  error         TEXT,
  ip            TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE IF NOT EXISTS event_tokens (
  id            TEXT PRIMARY KEY,
  site_id       TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  origin        TEXT NOT NULL,
  ip            TEXT,
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE INDEX IF NOT EXISTS idx_event_tokens_site_id
  ON event_tokens(site_id);

CREATE INDEX IF NOT EXISTS idx_event_tokens_expires_at
  ON event_tokens(expires_at);

CREATE TABLE IF NOT EXISTS event_dedup (
  site_id       TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (site_id, event_id),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE INDEX IF NOT EXISTS idx_event_dedup_created_at
  ON event_dedup(created_at);

CREATE TABLE IF NOT EXISTS admin_tokens (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  token_type    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_tokens_session_id
  ON admin_tokens(session_id);

CREATE INDEX IF NOT EXISTS idx_admin_tokens_expires_at
  ON admin_tokens(expires_at);
`

const SCHEMA_PG = `
CREATE TABLE IF NOT EXISTS sites (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  domain      TEXT NOT NULL,
  api_key     TEXT NOT NULL UNIQUE,
  pixel_id    TEXT NOT NULL,
  fb_token    TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note        TEXT
);

CREATE TABLE IF NOT EXISTS event_log (
  id            SERIAL PRIMARY KEY,
  site_id       TEXT NOT NULL REFERENCES sites(id),
  event_name    TEXT,
  fb_status     INTEGER,
  fb_events_received INTEGER,
  error         TEXT,
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_tokens (
  id            TEXT PRIMARY KEY,
  site_id       TEXT NOT NULL REFERENCES sites(id),
  token_hash    TEXT NOT NULL UNIQUE,
  origin        TEXT NOT NULL,
  ip            TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_tokens_site_id
  ON event_tokens(site_id);

CREATE INDEX IF NOT EXISTS idx_event_tokens_expires_at
  ON event_tokens(expires_at);

CREATE TABLE IF NOT EXISTS event_dedup (
  site_id       TEXT NOT NULL REFERENCES sites(id),
  event_id      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (site_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_dedup_created_at
  ON event_dedup(created_at);

CREATE TABLE IF NOT EXISTS admin_tokens (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  token_type    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_tokens_session_id
  ON admin_tokens(session_id);

CREATE INDEX IF NOT EXISTS idx_admin_tokens_expires_at
  ON admin_tokens(expires_at);
`

async function migrate() {
  const schema = db.driver === "postgres" ? SCHEMA_PG : SCHEMA
  await db.exec(schema)
  console.log(`✅  Migration complete (driver: ${db.driver})`)
  process.exit(0)
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})

export {}
