# AGENTS.md

## Repo Notes

- TypeScript strict、any 禁止。
- UI は Tailwind のみ。既存フォルダ構成と export 方針を維持する。
- フロントは静的 deploy、API は app repo compose で運用する。
- `/share/` は read-only 公開入口として扱い、API 書き込みと混同しない。

## Validation

```bash
pnpm -s check
```

deploy 関連や VPS 構成を変える場合は `service-manifest.yaml` も更新する。
