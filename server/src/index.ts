"use strict"

require("dotenv").config()

const express = require("express")
const helmet = require("helmet")
const cors = require("cors")
const rateLimit = require("express-rate-limit")
const path = require("path")

const adminRouter = require("./admin")
const eventsRouter = require("./events")

const app = express()
const PORT = process.env.PORT || 3000
const fbCapiClientPath = path.join(__dirname, "./fb-capi-client.js")

function getAdminAllowedOrigins() {
  return (process.env.ADMIN_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const adminAllowedOrigins = getAdminAllowedOrigins()

const adminCors = cors({
  origin(origin, cb) {
    if (!origin) {
      return cb(null, true)
    }

    if (adminAllowedOrigins.includes(origin)) {
      return cb(null, true)
    }

    return cb(null, false)
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
})

const publicOptionsCors = cors({
  origin: "*",
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
})

// ── Security headers ──────────────────────────────────────────────────────────
app.set("trust proxy", 1)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'"],
        "script-src-attr": ["'unsafe-inline'"],
      },
    },
  }),
)

app.options("/fb-capi-client.js", publicOptionsCors)
app.get("/fb-capi-client.js", publicOptionsCors, (_req, res) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
  res.sendFile(fbCapiClientPath)
})

app.options("/health", publicOptionsCors)
app.get("/health", publicOptionsCors, (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString() }),
)

app.options("/admin/*", adminCors)

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "64kb" }))

// ── Rate limiting on /event ───────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
})
app.use("/event", limiter)

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/event", eventsRouter)
app.use("/admin", adminCors, adminRouter)

app.use((_req, res) => res.status(404).json({ error: "Not found" }))

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err)
  res.status(500).json({ error: "Internal server error" })
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`FB CAPI Proxy running on port ${PORT}`)
  console.log(`Driver: ${process.env.DB_DRIVER || "sqlite"}`)
})

module.exports = app

export {}
