# mjscore

- TypeScript strict・any禁止、UIはTailwind。
- `/share/`はread-only公開入口。API書込みと分離する。
- SQLite更新のtransactionとoptimistic versionを維持する。legacy JSON migrationはbackupとdry-run後にone-way apply。live DBのbackupは既存 `backup:sqlite`。
- production frontend/API構成はprivate ops。app repoにはgeneric `compose.example.yml`だけを置く。
- browser flow変更は関連する `pnpm test:e2e`、通常の検証はpackage scriptsから選ぶ。
