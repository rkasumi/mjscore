# mjscore

- 目的: 麻雀スコア管理アプリ(Web + API)。
- スタック: TypeScript / React / Vite / Tailwind(web)、Express(API server)、Vitest / Playwright(テスト)。
- 主要コマンド: dev `pnpm dev`(web) + `pnpm dev:api`(API) / build `pnpm build`(web+API) / check `pnpm check`(lint→build) / test `pnpm test` / e2e `pnpm test:e2e` / typecheck `pnpm typecheck`
- 制約: UI は Tailwind のみ。既存フォルダ構成と export 方針を維持。`/share/` は read-only 公開入口、API 書き込みと混同しない。
- 注意: production compose・deploy は ops repo 管理。app repo には `compose.example.yml` のみ。
