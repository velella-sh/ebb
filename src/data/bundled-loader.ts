/**
 * Synchronous in-memory bundled data loader for Browser and Edge environments.
 */

import { BUNDLED_DATA } from "./bundled-data.js";
import { createJsonLoader, type DataLoader } from "./loader.js";

/**
 * Creates a DataLoader backed by all 25 bundled ecosystem datasets.
 * Works synchronously in any runtime (Browser, Worker, Deno, Bun, Node).
 */
export function createBundledLoader(): DataLoader {
  return createJsonLoader(BUNDLED_DATA);
}
