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
podman-compose up -d --build
```

For updates (pull + rebuild + restart):

```sh
cd /path/to/private
git pull
podman-compose up -d --build
```

Stop it when needed:

```sh
podman-compose down
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
