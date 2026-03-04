"use strict"

/**
 * db.js - thin abstraction over SQLite (better-sqlite3) or Postgres (pg).
 * Exposes a small interface used by the rest of the app:
 *   db.get(sql, params)   → single row | undefined
 *   db.all(sql, params)   → array of rows
 *   db.run(sql, params)   → { changes, lastInsertRowid }
 */

require("dotenv").config()

const driver = (process.env.DB_DRIVER || "sqlite").toLowerCase()

let db

// ── SQLite ────────────────────────────────────────────────────────────────────
if (driver === "sqlite") {
  const path = require("path")
  const fs = require("fs")
  const Database = require("better-sqlite3")

  const dbPath = process.env.SQLITE_PATH || "./data/proxy.db"
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const sqlite = new Database(dbPath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")

  db = {
    driver: "sqlite",
    _db: sqlite,

    get(sql, params = []) {
      return sqlite.prepare(sql).get(...params)
    },
    all(sql, params = []) {
      return sqlite.prepare(sql).all(...params)
    },
    run(sql, params = []) {
      const stmt = sqlite.prepare(sql)
      const info = stmt.run(...params)
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid }
    },
    exec(sql) {
      sqlite.exec(sql)
    },
  }

  // ── Postgres ──────────────────────────────────────────────────────────────────
} else if (driver === "postgres") {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  // Postgres uses $1 $2… placeholders; our callers use ? - convert on the fly.
  function toPositional(sql, params) {
    let i = 0
    const converted = sql.replace(/\?/g, () => `$${++i}`)
    return { sql: converted, params }
  }

  db = {
    driver: "postgres",
    _pool: pool,

    async get(sql, params = []) {
      const { sql: s, params: p } = toPositional(sql, params)
      const { rows } = await pool.query(s, p)
      return rows[0]
    },
    async all(sql, params = []) {
      const { sql: s, params: p } = toPositional(sql, params)
      const { rows } = await pool.query(s, p)
      return rows
    },
    async run(sql, params = []) {
      const { sql: s, params: p } = toPositional(sql, params)
      const result = await pool.query(s, p)
      return { changes: result.rowCount, lastInsertRowid: null }
    },
    async exec(sql) {
      await pool.query(sql)
    },
  }
} else {
  throw new Error(`Unknown DB_DRIVER "${driver}". Use "sqlite" or "postgres".`)
}

module.exports = db

export {}
