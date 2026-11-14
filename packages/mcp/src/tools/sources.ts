import { sourcesOf } from "@velella/ebb";
import type { McpTool, McpToolResult } from "../types.js";

export const sourcesTool: McpTool = {
  definition: {
    name: "sources_of",
    description:
      "Look up authoritative evidence sources, archive snapshot URLs, health status, and review provenance for a specific Ebb lifecycle rule.",
    inputSchema: {
      type: "object",
      properties: {
        ruleId: {
          type: "string",
          description: "ID of the lifecycle rule (e.g. 'nodejs.package.express.deprecated').",
        },
        asOf: {
          type: "string",
          description: "Optional reference date in YYYY-MM-DD format for time-travel evaluation.",
        },
      },
      required: ["ruleId"],
    },
  },
  handler: (args: Record<string, unknown>): McpToolResult => {
    const ruleId = typeof args.ruleId === "string" ? args.ruleId.trim() : "";
    if (!ruleId) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Missing required parameter 'ruleId'.",
          },
        ],
        isError: true,
      };
    }

    const asOf = typeof args.asOf === "string" ? args.asOf.trim() : undefined;

    try {
      const result = sourcesOf(ruleId, { asOf });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
