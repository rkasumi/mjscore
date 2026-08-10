import { readFileSync } from "node:fs";
import path from "node:path";

import { SessionRepository } from "./storage.js";

const readOption = (name: string): string | null => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : null;
};

const dataDir = process.env.DATA_DIR ?? "/data";
const sourcePath = readOption("--source") ?? path.join(dataDir, "session.json");
const databasePath = readOption("--database") ?? path.join(dataDir, "mjscore.sqlite");
const apply = process.argv.includes("--apply");
const payload = JSON.parse(readFileSync(sourcePath, "utf-8")) as unknown;

if (!apply) {
  const repository = new SessionRepository(":memory:", { allowLegacyData: true });
  try {
    const envelope = repository.importLegacyEnvelope(payload);
    console.log(
      `Dry run succeeded: version=${envelope.version}, session=${envelope.session?.id ?? "none"}`,
    );
    console.log("No files were changed. Pass --apply to write the SQLite database.");
  } finally {
    repository.close();
  }
} else {
  const repository = new SessionRepository(databasePath, { allowLegacyData: true });
  try {
    const envelope = repository.importLegacyEnvelope(payload);
    console.log(
      `Migration completed: database=${databasePath}, version=${envelope.version}, session=${envelope.session?.id ?? "none"}`,
    );
  } finally {
    repository.close();
  }
}
