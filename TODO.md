# TODO

- [x] Add root `pnpm` scripts to run both `server` and `dashboard` together (`dev`, `build`) for easier local workflow
- [ ] Add a quick filter/search box in the dashboard Sites table (by name/domain/pixel ID)
- [ ] Add one-click copy button for `Proxy URL` in Overview (same behavior as API key copy)
- [ ] Add auto-refresh toggle in dashboard for health + sites (e.g. every 20-30s)
- [ ] Add log filters in Logs view (status, event name, date range) for faster debugging
- [ ] Add simple pagination or "load more" for Logs to keep UI responsive with larger datasets
- [ ] Show "last event received at" per site in Overview table for at-a-glance activity
- [ ] Add a small `GET /version` endpoint in server with app version + environment
- [ ] Add basic request validation error details (`field`, `reason`) in API responses for easier integration debugging