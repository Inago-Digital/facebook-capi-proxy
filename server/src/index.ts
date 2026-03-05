"use strict"

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
})

import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express"
import helmet from "helmet"
import path from "path"
import rateLimit from "express-rate-limit"

import adminRouter from "./admin"
import eventsRouter from "./events"

type CorsMiddleware = (req: Request, res: Response, next: NextFunction) => void
type CorsFactory = (options: unknown) => CorsMiddleware
const cors = require("cors") as CorsFactory

const app = express()
const PORT = Number.parseInt(process.env.PORT ?? "", 10) || 3000
const fbCapiClientPath = path.join(__dirname, "./fb-capi-client.js")

function normalizeOrigin(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""

  try {
    return new URL(trimmed).origin.toLowerCase()
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase()
  }
}

function getAdminAllowedOrigins(): string[] {
  return (process.env.ADMIN_ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean)
}

const adminAllowedOrigins = getAdminAllowedOrigins()

const adminCors = cors({
  origin(
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void,
  ) {
    if (!origin) {
      return cb(null, true)
    }

    if (adminAllowedOrigins.includes(normalizeOrigin(origin))) {
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
app.get(
  "/fb-capi-client.js",
  publicOptionsCors,
  (_req: Request, res: Response) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin")
    res.sendFile(fbCapiClientPath)
  },
)

app.options("/health", publicOptionsCors)
app.get("/health", publicOptionsCors, (_req: Request, res: Response) =>
  res.json({ status: "ok", ts: new Date().toISOString() }),
)

app.options("/admin/*", adminCors)

app.use(express.json({ limit: "64kb" }))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.RATE_LIMIT_MAX ?? "", 10) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
})
app.use("/event", limiter)

app.use("/event", eventsRouter)
app.use("/admin", adminCors, adminRouter)

app.use((_req: Request, res: Response) =>
  res.status(404).json({ error: "Not found" }),
)

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err)
  res.status(500).json({ error: "Internal server error" })
})

app.listen(PORT, () => {
  console.log(`FB CAPI Proxy running on port ${PORT}`)
  console.log(`Driver: ${process.env.DB_DRIVER || "sqlite"}`)
})

export default app
