/**
 * `rulesFor(purl)`: every active lifecycle rule registered for a component.
 * Node.js entry point with active data resolver wired.
 */

import { getActiveDataSync } from "./data-source.js";
import { setNodeLoaderProvider } from "./data/load.js";

// Connect active data resolver to the data loader subsystem in Node
setNodeLoaderProvider(getActiveDataSync);

export * from "./rules-for-core.js";
