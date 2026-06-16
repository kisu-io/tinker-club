/**
 * ESM loader hook: resolves extensionless relative imports to .ts files.
 *
 * Node 24 strips TypeScript types natively but enforces strict ESM resolution
 * (no automatic extension inference). The source files in src/lib/ use
 * TypeScript-style extensionless imports (e.g. `import from "./db"`), which
 * the standard ESM resolver cannot find. This hook adds the .ts extension when
 * the bare path doesn't exist but a .ts variant does.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { resolve as pathResolve } from "node:path";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentDir = context.parentURL
      ? fileURLToPath(new URL(".", context.parentURL))
      : process.cwd();
    const fullPath = pathResolve(parentDir, specifier);
    if (!existsSync(fullPath) && existsSync(fullPath + ".ts")) {
      return nextResolve(specifier + ".ts", context);
    }
  }
  return nextResolve(specifier, context);
}
