# mjscore

`mjscore` is a small web app for tracking mahjong session results.

It includes:

- player and hand management
- score aggregation and rank summaries
- point trend charts
- shareable read-only snapshots
- a simple fu helper page
- an optional Express API for session sync

## Requirements

- Node.js 24
- pnpm 10.33.4

Enable Corepack if pnpm is not already available:

```sh
corepack enable
```

## Development

Install dependencies:

```sh
pnpm install --frozen-lockfile
```

Run the Vite frontend:

```sh
pnpm dev
```

Run the API server:

```sh
pnpm dev:api
```

Useful checks:

```sh
pnpm -s lint
pnpm -s test
pnpm -s typecheck
pnpm -s build
```

E2E tests use Playwright:

```sh
pnpm -s test:e2e
```

## Configuration

Local cross-origin API access can be enabled with an explicit allowlist:

```sh
CORS_ORIGIN=http://localhost:5173
```

Display mode is enabled when the query parameter includes `display=1`, `display=true`, or `display=display`.

Optional SPA build-time settings:

- `VITE_DISPLAY_REFRESH_INTERVAL_SEC` (default: `1800`) - how often the dark overlay appears
- `VITE_DISPLAY_REFRESH_DURATION_SEC` (default: `5`) - how long the overlay stays visible
- `VITE_INVITE_URL` - optional text shown in display mode
- `VITE_INVITE_IMAGE_SRC` - optional image path shown in display mode, such as `/invite.png`

Do not commit local invite QR images. `public/invite.png` is ignored for local deployments.

## Self-hosting Example

This repository keeps app code, local development, tests, build scripts, and a generic compose example. Deployment-specific scripts, public URLs, reverse proxy configuration, host ports, backups, and secret paths should live outside this repository.

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

## Publishing Notes

This repository is intended to be safe as source code. Keep deployment-specific values, generated builds, Playwright output, local databases, `.env` files, and invite QR images out of Git history.

## License

MIT License. See [LICENSE](./LICENSE).
