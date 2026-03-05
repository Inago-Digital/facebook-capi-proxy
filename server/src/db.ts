"use strict"

/**
 * db.ts - thin abstraction over SQLite (better-sqlite3) or Postgres (pg).
 */

require("dotenv").config()

const driver = (process.env.DB_DRIVER || "sqlite").toLowerCase()

export type DBDriver = "sqlite" | "postgres"
export type SQLParam = string | number | boolean | null

type DBRow = Record<string, unknown>

interface SQLiteRunInfo {
  changes: number
  lastInsertRowid: number | bigint
}

interface SQLiteStatement {
  get(...params: SQLParam[]): DBRow | undefined
  all(...params: SQLParam[]): DBRow[]
  run(...params: SQLParam[]): SQLiteRunInfo
}

interface SQLiteDatabase {
  pragma(sql: string): void
  prepare(sql: string): SQLiteStatement
  exec(sql: string): void
}

interface SQLiteDatabaseCtor {
  new (filename: string): SQLiteDatabase
}

interface PostgresQueryResult {
  rows: DBRow[]
  rowCount: number | null
}

interface PostgresPool {
  query(sql: string, params?: SQLParam[]): Promise<PostgresQueryResult>
}

interface PostgresPoolCtor {
  new (options: { connectionString?: string }): PostgresPool
}

export interface RunResult {
  changes: number
  lastInsertRowid: number | bigint | null
}

export interface DBAdapter {
  driver: DBDriver
  get<T extends object = DBRow>(sql: string, params?: SQLParam[]): Promise<T | undefined>
  all<T extends object = DBRow>(sql: string, params?: SQLParam[]): Promise<T[]>
  run(sql: string, params?: SQLParam[]): Promise<RunResult>
  exec(sql: string): Promise<void>
}

type SQLiteAdapter = DBAdapter & {
  driver: "sqlite"
  _db: SQLiteDatabase
}

type PostgresAdapter = DBAdapter & {
  driver: "postgres"
  _pool: PostgresPool
}

let db: SQLiteAdapter | PostgresAdapter

if (driver === "sqlite") {
  const path = require("path") as typeof import("path")
  const fs = require("fs") as typeof import("fs")
  const BetterSqlite3 = require("better-sqlite3") as SQLiteDatabaseCtor

  const dbPath = process.env.SQLITE_PATH || "./data/proxy.db"
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const sqlite = new BetterSqlite3(dbPath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")

  db = {
    driver: "sqlite",
    _db: sqlite,

    async get<T extends object = DBRow>(sql: string, params: SQLParam[] = []) {
      return sqlite.prepare(sql).get(...params) as T | undefined
    },

    async all<T extends object = DBRow>(sql: string, params: SQLParam[] = []) {
      return sqlite.prepare(sql).all(...params) as T[]
    },

    async run(sql: string, params: SQLParam[] = []) {
      const stmt = sqlite.prepare(sql)
      const info = stmt.run(...params)
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid }
    },

    async exec(sql: string) {
      sqlite.exec(sql)
    },
  }
} else if (driver === "postgres") {
  const { Pool: PgPool } = require("pg") as { Pool: PostgresPoolCtor }
  const pool = new PgPool({ connectionString: process.env.DATABASE_URL })

  function toPositional(sql: string, params: SQLParam[]) {
    let i = 0
    const converted = sql.replace(/\?/g, () => `$${++i}`)
    return { sql: converted, params }
  }

  db = {
    driver: "postgres",
    _pool: pool,

    async get<T extends object = DBRow>(sql: string, params: SQLParam[] = []) {
      const { sql: s, params: p } = toPositional(sql, params)
      const { rows } = await pool.query(s, p)
      return rows[0] as T | undefined
    },

    async all<T extends object = DBRow>(sql: string, params: SQLParam[] = []) {
      const { sql: s, params: p } = toPositional(sql, params)
      const { rows } = await pool.query(s, p)
      return rows as T[]
    },

    async run(sql: string, params: SQLParam[] = []) {
      const { sql: s, params: p } = toPositional(sql, params)
      const result = await pool.query(s, p)
      return { changes: result.rowCount ?? 0, lastInsertRowid: null }
    },

    async exec(sql: string) {
      await pool.query(sql)
    },
  }
} else {
  throw new Error(`Unknown DB_DRIVER "${driver}". Use "sqlite" or "postgres".`)
}

export default db
