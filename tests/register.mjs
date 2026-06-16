/**
 * Registers the .ts extension-resolution hook via the modern module.register
 * API (the `--loader` flag is deprecated). Loaded with `node --import`.
 */
import { register } from "node:module";
register("./loader.mjs", import.meta.url);
