# Deploy Find My Class (Docker + Caddy)

## Requirements

- Ubuntu VPS (or similar) with Docker + Docker Compose
- Domain pointed at the VPS (optional but recommended)
- Deployed Google Apps Script web app bound to the GRC planner spreadsheet (see [SHEETS_SETUP.md](./SHEETS_SETUP.md))

## Environment

Copy `.env.example` and set:

```bash
SHEETS_API_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
SHEETS_API_TOKEN=your-shared-secret
REVALIDATE_SECONDS=600
DEFAULT_TERM_CODE=2271
```

If `SHEETS_API_URL` is empty, the Next.js app falls back to `fixtures/sheets-api-*.json` (demo mode).

## Build & run

```bash
docker compose up -d --build
curl -I http://127.0.0.1:3000
```

## Caddy reverse proxy

1. Put `Caddyfile.example` content into your Caddyfile with your real domain.
2. Ensure Compose network reachability (`reverse_proxy find-my-class:3000`) or proxy to `host.docker.internal:3000` / `127.0.0.1:3000` depending on layout.
3. Reload Caddy.

## Dokploy / Traefik note

Behind Cloudflare Tunnel → Traefik, prefer **HTTP origin** (not Let's Encrypt on the container) to avoid 502s. Attach the service to `dokploy-network` and set the public hostname accordingly.

## Updates

```bash
git pull
docker compose up -d --build
```

## What is not automated here

- Apps Script clasp deploy and time-driven triggers (manual, sheet owner)
- Live ctcLink cookie/session durability (sync job best-effort)
- Guaranteed enroll deep-links (ctcLink often requires login; UI still shows `class_nbr`)
