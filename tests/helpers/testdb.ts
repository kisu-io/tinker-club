import os from "node:os";
import fs from "node:fs";
import path from "node:path";

// Must run before src/lib/db.ts opens its lazy singleton (first query).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-test-"));
process.env.DATA_DIR = dir;
// NODE_ENV is typed readonly by Next's globals; cast to set it for tests.
(process.env as { NODE_ENV?: string }).NODE_ENV = "test";

export const TEST_DATA_DIR = dir;

export function cleanup(): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Remove the temp DB dir when the test process exits so /tmp doesn't accumulate.
process.on("exit", cleanup);
