"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env"),
});
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const admin_1 = __importDefault(require("./admin"));
const events_1 = __importDefault(require("./events"));
const cors = require("cors");
const app = (0, express_1.default)();
const PORT = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const fbCapiClientPath = path_1.default.join(__dirname, "./fb-capi-client.js");
function normalizeOrigin(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return "";
    try {
        return new URL(trimmed).origin.toLowerCase();
    }
    catch {
        return trimmed.replace(/\/+$/, "").toLowerCase();
    }
}
function getAdminAllowedOrigins() {
    return (process.env.ADMIN_ALLOWED_ORIGINS || "")
        .split(",")
        .map(normalizeOrigin)
        .filter(Boolean);
}
const adminAllowedOrigins = getAdminAllowedOrigins();
const adminCors = cors({
    origin(origin, cb) {
        if (!origin) {
            return cb(null, true);
        }
        if (adminAllowedOrigins.includes(normalizeOrigin(origin))) {
            return cb(null, true);
        }
        return cb(null, false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
});
const publicOptionsCors = cors({
    origin: "*",
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
});
app.set("trust proxy", 1);
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            ...helmet_1.default.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'"],
            "script-src-attr": ["'unsafe-inline'"],
        },
    },
}));
app.options("/fb-capi-client.js", publicOptionsCors);
app.get("/fb-capi-client.js", publicOptionsCors, (_req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(fbCapiClientPath);
});
app.options("/health", publicOptionsCors);
app.get("/health", publicOptionsCors, (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));
app.options("/version", publicOptionsCors);
app.get("/version", publicOptionsCors, (_req, res) => res.json({
    version: process.env.npm_package_version,
    env: process.env.NODE_ENV,
}));
app.options("/admin/*", adminCors);
app.use(express_1.default.json({ limit: "64kb" }));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: Number.parseInt(process.env.RATE_LIMIT_MAX ?? "", 10) || 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
});
app.use("/event", limiter);
app.use("/event", events_1.default);
app.use("/admin", adminCors, admin_1.default);
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
});
app.listen(PORT, () => {
    console.log(`FB CAPI Proxy running on port ${PORT}`);
    console.log(`Driver: ${process.env.DB_DRIVER || "sqlite"}`);
});
exports.default = app;
