# mjscore

## Production deployment (nginx + Podman compose)

### 1) Build and deploy the SPA

```sh
pnpm install
VITE_API_BASE_URL=/api pnpm build:web
```

Copy the built assets to the web root:

```sh
sudo mkdir -p /path/to/web-root
sudo rsync -a --delete dist/ /path/to/web-root
```

### 2) Prepare the API container (Podman)

On the server, place the repository at `/path/to/private`:

```sh
sudo mkdir -p /path/to/private
sudo rsync -a --delete ./ /path/to/private
```

If you prefer `scp` with a minimal file set:

```sh
scp -r Containerfile compose.yml package.json pnpm-lock.yaml tsconfig.json server/tsconfig.json \
  server shared deploy/nginx/mjscore.conf USER@HOST:/path/to/private
```

Create the data directory for persistence (optional but recommended):

```sh
sudo mkdir -p /path/to/private
sudo chown 1000:1000 /path/to/private
```

Create `/path/to/private` for secrets and runtime config:

```sh
PORT=8080
DATA_DIR=/data
```

Build the API image:

```sh
cd /path/to/private
podman build -t mjscore-api:latest -f Containerfile .
```

Start the API with Podman compose:

```sh
podman compose up -d
```

Stop it when needed:

```sh
podman compose down
```

### 3) nginx configuration (SPA + /api proxy)

Copy `deploy/nginx/mjscore.conf` to `/etc/nginx/conf.d/mjscore.conf` and reload:

```sh
sudo cp /path/to/private /etc/nginx/conf.d/mjscore.conf
sudo nginx -t && sudo systemctl reload nginx
```

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
podman logs -f mjscore-api
```
