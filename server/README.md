# FB CAPI Proxy

Multi-tenant server-side proxy for Facebook Conversions API events with a standalone admin dashboard.

```text
Static site  ──POST /event/auth──►  access token
            └─POST /event (Bearer + X-Api-Key)──► Proxy API ──► Facebook CAPI
```

## What Changed

Admin authentication is now token-session based and designed for standalone dashboard deployment.

- Added `/admin/auth/login|refresh|logout|me`
- `/admin/sites*` now requires **access token** auth
- Removed cookie admin sessions and direct `Bearer <ADMIN_SECRET>` access for management routes
- Dashboard is now a separate app in `dashboard/`
- `/event` now requires a short-lived access token from `/event/auth`
- Added strict origin checks, per-site/IP rate limit, and `event_id` replay protection

## Backend Setup

```bash
npm install
cp .env.example .env
npm run migrate
npm start
```

## Backend Environment Variables

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DB_DRIVER` | `sqlite` | `sqlite` or `postgres` |
| `SQLITE_PATH` | `./data/proxy.db` | SQLite path |
| `DATABASE_URL` | | Postgres connection string |
| `ADMIN_SECRET` | required | Used only for `/admin/auth/login` |
| `ADMIN_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated allowed dashboard origins for `/admin` CORS |
| `ADMIN_ACCESS_TTL_MINUTES` | `15` | Access token TTL |
| `ADMIN_REFRESH_TTL_DAYS` | `7` | Refresh token TTL |
| `RATE_LIMIT_MAX` | `200` | Max `/event` requests per IP / 15 min |
| `EVENT_SITE_RATE_LIMIT_MAX` | `120` | Max `/event` requests per site+IP window |
| `EVENT_SITE_RATE_LIMIT_WINDOW_MS` | `900000` | Site+IP limiter window |
| `EVENT_ACCESS_TTL_SECONDS` | `300` | `/event/auth` token TTL |
| `EVENT_DEDUP_TTL_HOURS` | `48` | Replay dedupe retention |
| `EVENT_REQUIRE_ORIGIN` | `true` | Require `Origin`/`Referer` |
| `EVENT_REQUIRE_EVENT_SOURCE_URL` | `true` | Require event `event_source_url` |
| `EVENT_TOKEN_BIND_IP` | `false` | Bind event token to caller IP |
| `FB_CAPI_URL` | `https://graph.facebook.com/v19.0` | Facebook CAPI base URL |

## Admin Auth API

```text
POST /admin/auth/login
  body: { "secret": "<ADMIN_SECRET>" }
  -> { access_token, refresh_token, access_expires_at, refresh_expires_at }

POST /admin/auth/refresh
  body: { "refresh_token": "..." }
  -> rotated token pair

POST /admin/auth/logout
  body: { "refresh_token": "..." }
  -> { ok: true }

GET /admin/auth/me
  header: Authorization: Bearer <access_token>
  -> { authenticated: true, access_expires_at }
```

## Admin Management API

All routes below require `Authorization: Bearer <access_token>`:

```text
POST   /admin/sites
GET    /admin/sites
GET    /admin/sites/:id
PATCH  /admin/sites/:id
DELETE /admin/sites/:id
POST   /admin/sites/:id/rotate
GET    /admin/sites/:id/stats?limit=N
```

## Event Endpoint (Public)

### 1) Issue short-lived event token

```http
POST /event/auth
X-Api-Key: capi_<key>
Content-Type: application/json

{
  "event_source_url": "https://shop.example.com/checkout"
}
```

Response:

```json
{
  "access_token": "...",
  "expires_at": "2026-03-04T12:00:00.000Z",
  "token_type": "Bearer"
}
```

### 2) Send event payload

```http
POST /event
X-Api-Key: capi_<key>
Authorization: Bearer <access_token>
Content-Type: application/json
```

`/event` remains public, but now requires:
- site API key
- short-lived access token from `/event/auth`
- strict matching origin/domain checks
- unique `event_id` values (replay-protected)

## Standalone Dashboard

The dashboard now lives in `dashboard/` and builds to static assets (`dashboard/dist`).

```bash
cd dashboard
cp .env.example .env
npm install
npm run dev
npm run build
npm run preview
```

Set `VITE_API_BASE_URL` in `dashboard/.env` to your backend API origin.

## Deployment Notes

- Deploy backend API and dashboard independently.
- Add deployed dashboard origin(s) to `ADMIN_ALLOWED_ORIGINS`.
- Use HTTPS in production.
- Restrict `/admin` at network or reverse-proxy level when possible.
