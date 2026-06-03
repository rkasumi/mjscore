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

For local cross-origin development, set `CORS_ORIGIN` to an explicit comma-separated allowlist.
Tailwind remains on v3 because the existing PostCSS/Tailwind config is stable and the v4 migration is a separate CSS toolchain change.

## Self-hosting example

This repo keeps app code, local development, tests, build, and a generic compose example. Production deploy scripts, production compose, public URL, host port, nginx, backup, and secret paths are managed in a private ops repo.

Build the SPA:

```sh
pnpm build:web
```

Run the API with the generic compose example:

```sh
docker compose -f compose.example.yml up -d --build
```

Stop it when needed:

```sh
docker compose -f compose.example.yml down
```

If you put the API behind your own reverse proxy, expose `/session` and `/health` to the browser under whatever path your deployment chooses.

Direct API check:

```sh
curl -f http://127.0.0.1:8080/health
```

API logs:

```sh
docker logs -f mjscore-api
```
