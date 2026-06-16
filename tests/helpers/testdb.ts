import os from "node:os";
import fs from "node:fs";
import path from "node:path";

// Must run before src/lib/db.ts opens its lazy singleton (first query).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-test-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";

export const TEST_DATA_DIR = dir;

export function cleanup(): void {
  fs.rmSync(dir, { recursive: true, force: true });
}
