import { supportedVersions } from "../../index.js";
import type { SupportedVersionsResult } from "../../pick-version.js";
import type { McpTool, McpToolResult } from "../types.js";

function summary(result: SupportedVersionsResult): string {
  const lines = result.lines.map((line) => line.id).join(", ") || "none";
  const recommended = result.recommendation?.lineId ?? "none";
  return [
    `${result.purl ?? "unknown"} as of ${result.asOf}`,
    `complete: ${result.complete ? "yes" : "no"}`,
    `lines: ${lines}`,
    `recommended: ${recommended}`,
    result.reason,
    ...result.notes,
  ].join("\n");
}

export const pickVersionTool: McpTool = {
  definition: {
    name: "pick_version",
    description:
      "Call before choosing a runtime or a major version. Returns the release lines Ebb knows, the line it recommends, and whether that answer is complete. It does not claim a line is supported when no rule names it.",
    inputSchema: {
      type: "object",
      properties: {
        purl: {
          type: "string",
          description: "Package URL (e.g. 'pkg:generic/nodejs') or bare product name (e.g. 'node', 'python').",
        },
        as_of: {
          type: "string",
          description: "Optional reference date YYYY-MM-DD. When set, the system clock is not read.",
        },
      },
      required: ["purl"],
    },
  },
  handler: (args: Record<string, unknown>): McpToolResult => {
    const purlArg = typeof args.purl === "string" ? args.purl.trim() : "";
    if (!purlArg) {
      return {
        content: [{ type: "text", text: "Error: 'purl' parameter is required and must not be empty." }],
        isError: true,
      };
    }

    const asOf = typeof args.as_of === "string" ? args.as_of : undefined;
    try {
      const result = supportedVersions(purlArg, asOf === undefined ? undefined : { asOf });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ summary: summary(result), ...result }, null, 2),
          },
        ],
        isError: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error choosing a version: ${message}` }],
        isError: true,
      };
    }
  },
};
