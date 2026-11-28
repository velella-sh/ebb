import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Server-render each authored pair so both columns retain their signed evidence.
const tools = process.env.EBB_SITE_TOOLS;
if (!tools) throw new Error("EBB_SITE_TOOLS must name the pinned site tools' node_modules directory.");
const lateen = await import(pathToFileURL(join(tools, "@velella/lateen/components/compare/index.ts")).href);
export const directive = lateen.directive;
export default lateen.default;
