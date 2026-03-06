"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * db.ts - thin abstraction over SQLite (better-sqlite3) or Postgres (pg).
 */
require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env"),
});
const driver = (process.env.DB_DRIVER || "sqlite").toLowerCase();
let db;
if (driver === "sqlite") {
    const path = require("path");
    const fs = require("fs");
    const BetterSqlite3 = require("better-sqlite3");
    const dbPath = process.env.SQLITE_PATH || "./data/proxy.db";
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new BetterSqlite3(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    db = {
        driver: "sqlite",
        _db: sqlite,
        async get(sql, params = []) {
            return sqlite.prepare(sql).get(...params);
        },
        async all(sql, params = []) {
            return sqlite.prepare(sql).all(...params);
        },
        async run(sql, params = []) {
            const stmt = sqlite.prepare(sql);
            const info = stmt.run(...params);
            return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
        },
        async exec(sql) {
            sqlite.exec(sql);
        },
    };
}
else if (driver === "postgres") {
    const { Pool: PgPool } = require("pg");
    const pool = new PgPool({ connectionString: process.env.DATABASE_URL });
    function toPositional(sql, params) {
        let i = 0;
        const converted = sql.replace(/\?/g, () => `$${++i}`);
        return { sql: converted, params };
    }
    db = {
        driver: "postgres",
        _pool: pool,
        async get(sql, params = []) {
            const { sql: s, params: p } = toPositional(sql, params);
            const { rows } = await pool.query(s, p);
            return rows[0];
        },
        async all(sql, params = []) {
            const { sql: s, params: p } = toPositional(sql, params);
            const { rows } = await pool.query(s, p);
            return rows;
        },
        async run(sql, params = []) {
            const { sql: s, params: p } = toPositional(sql, params);
            const result = await pool.query(s, p);
            return { changes: result.rowCount ?? 0, lastInsertRowid: null };
        },
        async exec(sql) {
            await pool.query(sql);
        },
    };
}
else {
    throw new Error(`Unknown DB_DRIVER "${driver}". Use "sqlite" or "postgres".`);
}
exports.default = db;
