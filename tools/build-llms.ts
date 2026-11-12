import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const llmsPath = join(repoRoot, "llms.txt");
const llmsFullPath = join(repoRoot, "llms-full.txt");

export function buildLlmsFull(): string {
  const baseLlms = readFileSync(llmsPath, "utf-8");

  let typesContent = "";
  try {
    typesContent = readFileSync(join(repoRoot, "docs/TYPES.md"), "utf-8");
  } catch {
    typesContent = "See TypeScript definitions in dist/src/index.d.ts";
  }

  let apiContent = "";
  try {
    apiContent = readFileSync(join(repoRoot, "docs/api/README.md"), "utf-8");
  } catch {
    apiContent = "See docs/api/ for complete documentation.";
  }

  const sections: string[] = [
    baseLlms,
    "",
    "---",
    "",
    "# Extended Technical Documentation and Schema Specification",
    "",
    "## 1. Rule Format Specification (Schema Version 2)",
    "",
    "Every lifecycle rule in Ebb conforms to the `rule.v2` schema. Rules define when a package version enters a lifecycle phase.",
    "",
    "### Core Rule Fields",
    "- `id` (string): Unique canonical identifier, e.g. `npm.package.request.deprecated`.",
    "- `ecosystem` (string): Package ecosystem (`npm`, `pypi`, `github-actions`, `container`, `nodejs`, `database`, etc.).",
    "- `purl` (string): Canonical Package URL identifying the software component.",
    "- `vers` (string): Version range constraint formatted according to the VERS specification (`vers:<scheme>/<range>`).",
    "- `event` (string): Lifecycle transition event. One of:",
    "  - `deprecated`: Upstream maintainers officially deprecated the package.",
    "  - `end-of-life`: The version has reached official end-of-life or end-of-support.",
    "  - `unsupported`: No longer receiving updates or security fixes.",
    "  - `removed`: The package or feature has been removed or yanked.",
    "  - `scheduled`: A planned deprecation or end-of-life date has been announced in the future.",
    "- `status` (string): The resulting lifecycle verdict when the rule matches (`deprecated`, `end-of-life`, `unsupported`, `removed`, `scheduled`).",
    "- `title` (string): Short descriptive title.",
    "- `summary` (string): Detailed explanation of the deprecation or lifecycle state.",
    "- `severity` (string): Impact level (`low`, `medium`, `high`, `critical`).",
    "- `replacement` (string, optional): Authoritative recommended alternative or upgrade path.",
    "- `deadline` (string, optional): ISO date (`YYYY-MM-DD`) when the transition takes or took effect.",
    "- `sources` (array): Authoritative evidence URLs with accessed dates.",
    "- `provenance` (object): Review metadata including `observedAt`, `reviewedAt`, and `reviewer` username.",
    "- `migration` (object, optional): Step-by-step guidance for automated or manual refactoring.",
    "",
    "### Example Registry Rule",
    "```json",
    JSON.stringify(
      {
        id: "npm.package.request.deprecated",
        ecosystem: "npm",
        purl: "pkg:npm/request",
        vers: "vers:npm/*",
        event: "deprecated",
        title: "request is deprecated",
        summary: "The package is fully deprecated and no new changes are expected.",
        severity: "high",
        replacement: "Native fetch or a maintained HTTP client",
        deadline: "2020-02-11",
        sources: [
          {
            title: "request deprecation announcement",
            url: "https://www.npmjs.com/package/request",
            accessedAt: "2026-10-13",
          },
        ],
        provenance: {
          observedAt: "2026-10-13",
          reviewedAt: "2026-10-14",
          reviewer: "arminazimi",
        },
      },
      null,
      2,
    ),
    "```",
    "",
    "## 2. Complete TypeScript Type Reference",
    "",
    typesContent,
    "",
    "## 3. Detailed API Reference",
    "",
    apiContent,
    "",
    "## 4. MCP Tools Schema for Agents",
    "",
    "When integrating Ebb via MCP, the server exposes three core tools and one resource:",
    "",
    "### Tool: `check`",
    "- **Description**: Check whether a software component version is deprecated or end-of-life.",
    "- **Parameters**:",
    "  - `purl` (string, required): Package URL, e.g. `pkg:npm/request`.",
    "  - `version` (string, required): Specific component version string, e.g. `2.88.2`.",
    "  - `asOf` (string, optional): ISO date `YYYY-MM-DD` to evaluate against.",
    "",
    "### Tool: `check_all`",
    "- **Description**: Evaluate multiple component dependencies in batch.",
    "- **Parameters**:",
    "  - `components` (array, required): Array of objects with `purl` and `version`.",
    "",
    "### Tool: `replacement_for`",
    "- **Description**: Get the recommended replacement or migration guidance for a component.",
    "- **Parameters**:",
    "  - `purl` (string, required): Package URL of the deprecated component.",
    "",
    "### Resource: `ebb://upcoming`",
    "- **Description**: Live list of upcoming scheduled end-of-life deadlines within the next 90 days.",
    "",
    "## 5. Agent Skill Integration (`check-before-add`)",
    "",
    "Agents configured with the `check-before-add` skill adhere to these invariant rules:",
    "1. Never execute `npm install <pkg>`, `pip install <pkg>`, or write dependencies into manifest files without first querying `check(purl, version)`.",
    '2. If Ebb returns `status: "deprecated"` or `status: "end-of-life"`, the agent halts installation and immediately proposes the recommended alternative from `replacementFor(purl)`.',
    "3. Keep output concise: indicate component status, deadline (if any), and the modern alternative.",
  ];

  const fullContent = sections.join("\n");
  writeFileSync(llmsFullPath, fullContent, "utf-8");
  return fullContent;
}

if (process.argv[1] && process.argv[1].endsWith("build-llms.js")) {
  buildLlmsFull();
  if (process.env.VERBOSE === "true") {
    console.log("[build-llms] Generated llms-full.txt successfully.");
  }
}
