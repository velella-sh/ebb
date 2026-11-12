/**
 * `check(purlOrName, version, asOf?)`: one answer for a component's lifecycle status.
 * Node.js entry point with active data resolver wired.
 */

import { getActiveDataSync } from "./data-source.js";
import { setNodeLoaderProvider } from "./data/load.js";

// Connect active data resolver to the data loader subsystem in Node
setNodeLoaderProvider(getActiveDataSync);

export * from "./check-core.js";
