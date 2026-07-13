import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

export const createSqliteBackup = async (
  sourcePath: string,
  outputPath: string,
): Promise<number> => {
  const resolvedSource = path.resolve(sourcePath);
  const resolvedOutput = path.resolve(outputPath);
  if (resolvedSource === resolvedOutput) {
    throw new Error("Backup output must differ from the source database");
  }
  if (!existsSync(resolvedSource)) {
    throw new Error(`Source database does not exist: ${resolvedSource}`);
  }

  mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  const temporaryPath = `${resolvedOutput}.tmp`;
  rmSync(temporaryPath, { force: true });

  const source = new DatabaseSync(resolvedSource, { readOnly: true });
  try {
    const pages = await backup(source, temporaryPath);
    const snapshot = new DatabaseSync(temporaryPath, { readOnly: true });
    try {
      const check = snapshot.prepare("PRAGMA quick_check").get();
      if (check?.quick_check !== "ok") {
        throw new Error("SQLite backup quick_check failed");
      }
    } finally {
      snapshot.close();
    }
    renameSync(temporaryPath, resolvedOutput);
    return pages;
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  } finally {
    source.close();
  }
};
