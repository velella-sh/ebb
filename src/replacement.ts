/**
 * `replacementFor(purl, version)`: suggested replacement for a matched component version.
 * Node.js entry point with active data resolver wired.
 */

import { getActiveDataSync } from "./data-source.js";
import { setNodeLoaderProvider } from "./data/load.js";

// Connect active data resolver to the data loader subsystem in Node
setNodeLoaderProvider(getActiveDataSync);

export * from "./replacement-core.js";
