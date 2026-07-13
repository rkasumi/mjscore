import path from "node:path";

import { createSqliteBackup } from "./sqlite-backup.js";

const readOption = (name: string): string | null => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : null;
};

const dataDir = process.env.DATA_DIR ?? "/data";
const sourcePath = readOption("--source") ?? path.join(dataDir, "mjscore.sqlite");
const outputPath =
  readOption("--output") ?? path.join(dataDir, "backups", "mjscore.sqlite");

const pages = await createSqliteBackup(sourcePath, outputPath);
console.log(`SQLite backup completed: output=${outputPath}, pages=${pages}`);
