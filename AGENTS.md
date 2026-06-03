# AGENTS.md

## Repo Notes

- TypeScript strict、any 禁止。
- UI は Tailwind のみ。既存フォルダ構成と export 方針を維持する。
- フロントの production deploy と API production compose は、この repo の外側で管理する。
- app repo には local / generic self-hosting 用の `compose.example.yml` だけを置く。
- `/share/` は read-only 公開入口として扱い、API 書き込みと混同しない。

## Validation

```bash
pnpm -s check
```

deploy 関連や hosted 環境の構成を変える場合は、app repo に private deployment surface を戻さない。
