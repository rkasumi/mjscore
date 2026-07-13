# mjscore

`mjscore` is a small web app for tracking mahjong session results.

It includes:

- player and hand management
- score aggregation and rank summaries
- point trend charts
- shareable read-only snapshots
- a simple fu helper page
- an optional Express API for session sync
- SQLite-backed session history for the API
- historical rankings, direct matchups, personal records, and saved seasons

## Requirements

- Node.js 24.18.x
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

The Vite development server proxies `/api` to `http://127.0.0.1:3000`, so the
two commands above work together without additional CORS configuration.

The API stores data in `${DATA_DIR:-/data}/mjscore.sqlite`. Writes use SQLite
transactions and optimistic version checks. Starting a session with a new ID
finalizes the previous active session instead of deleting it.

### Migrating the legacy JSON store

The API refuses to create a new database when a legacy `session.json` exists in
the same data directory. Validate the migration first:

```sh
DATA_DIR=/path/to/data pnpm migrate:json
```

The dry run does not change files. Apply it only after confirming the output and
backing up the data directory:

```sh
DATA_DIR=/path/to/data pnpm migrate:json -- --apply
```

For a built API image, run the equivalent compiled command:

```sh
node server/dist/server/migrate-json.js --apply
```

The migration is intentionally one-way and does not delete `session.json`.

### Creating a SQLite-consistent backup

Create an online backup while the API is running with:

```sh
DATA_DIR=/path/to/data pnpm backup:sqlite
```

By default this writes `backups/mjscore.sqlite` under `DATA_DIR`. The command
backs up to a temporary file, runs `PRAGMA quick_check`, and atomically replaces
the previous checked backup. The compiled production command is:

```sh
node server/dist/server/backup-sqlite.js \
  --source /data/mjscore.sqlite \
  --output /data/backups/mjscore.sqlite
```

Use this checked standalone file as the restic backup source instead of copying
the live database, WAL, and SHM files independently.

## Stored Results and Analytics

Starting a new table finalizes the previous one. A table can also be finalized
without starting another table, reopened from result history, or marked as
excluded from analytics without deleting its data.

The analytics view includes:

- all-time and date-range rankings
- monthly and saved-season rankings
- total and average points, average rank, top rate, last rate, and rank counts
- head-to-head results for players who shared a hand
- highest/lowest score, best/worst hand points, and longest top streak

Only finalized, non-voided tables are included in analytics. `/share/` remains
an explicitly generated read-only snapshot and does not expose result-history
listing APIs.

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

Optional runtime SPA settings can be placed in `public/config.json` for local/self-hosted deployments:

```json
{
  "defaultPlayerNames": ["Alice", "Bob"],
  "fixedPlayerCount": 2
}
```

- `defaultPlayerNames` - optional default player names; valid when set to 1-6 non-empty names
- `fixedPlayerCount` - optional number of default players to lock from the start of `defaultPlayerNames`; defaults to all configured default players

When `config.json` is missing or invalid, the app uses `プレイヤー1` through `プレイヤー4` and no players are locked. Do not commit local invite QR images or personal config. `public/invite.png` and `public/config.json` are ignored for local deployments.

## Self-hosting Example

This repository keeps app code, local development, tests, build scripts, and a generic compose example. Deployment-specific scripts, public URLs, reverse proxy configuration, host ports, backups, and secret paths should live outside this repository.

Back up the SQLite database with a SQLite-consistent snapshot mechanism. When
WAL mode is active, copying only `mjscore.sqlite` while the API is running is not
a complete backup.

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
