# mjscore

## Development

```sh
pnpm dev
pnpm dev:api
pnpm build
pnpm -s check
```

## Display mode (TV)

Display mode is enabled when the query parameter includes `display=1`, `display=true`, or `display=display`.

Optional SPA build-time settings (seconds):

- `VITE_DISPLAY_REFRESH_INTERVAL_SEC` (default: `1800`) - how often the dark overlay appears
- `VITE_DISPLAY_REFRESH_DURATION_SEC` (default: `5`) - how long the overlay stays visible
- `VITE_DISPLAY_GRAPH_ROTATE_SEC` (default: `60`) - graph rotation interval in display mode

## Production deployment (ops nginx + Docker Compose)

### 1) Build and deploy the SPA

```sh
./scripts/deploy.sh
```

Default target:

- host: `rkasumi`
- path: `/path/to/web-root`
- `VITE_API_BASE_URL`: `/api`

Override example:

```sh
TARGET_HOST=other-host \
TARGET_PATH=/path/to/web-root \
VITE_API_BASE_URL=/api \
./scripts/deploy.sh
```

### 2) Prepare the API container (Docker)

On the server, clone the repository to `/path/to/private`:

```sh
sudo mkdir -p /path/to/private
sudo git clone <REPO_URL> /path/to/private
```

For updates later:

```sh
cd /path/to/private
sudo git pull
```

Create the data directory for persistence (optional but recommended):

```sh
sudo mkdir -p /path/to/private
sudo chown 1000:1000 /path/to/private
```

Initial start (build + run):

```sh
cd /path/to/private
docker compose up -d --build
```

For updates (pull + rebuild + restart):

```sh
cd /path/to/private
git pull
docker compose up -d --build
```

Stop it when needed:

```sh
docker compose down
```

### 3) nginx configuration (managed by ops)

On the VPS, the nginx config is managed in the `ops` repository, not from this repository.

- source of truth: `ops/server/nginx/conf.d/example.com.conf`
- current SPA web root: `/path/to/web-root`
- current API upstream: `http://127.0.0.1:18080`

`deploy/nginx/mjscore.conf` is a local reference/example only. Do not copy it over the VPS nginx config unless you are intentionally updating the ops-managed configuration as well.

Note: the API exposes `/session` and `/health`. The nginx `/api/` proxy strips the prefix, so `/api/session` maps to the API `/session` without rewrites.

### 4) Health check and logs

Health check via nginx:

```sh
curl -f http://localhost/api/health
```

Direct API check:

```sh
curl -f http://127.0.0.1:18080/health
```

API logs:

```sh
docker logs -f mjscore-api
```
