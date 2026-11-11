import { checkAll, type CheckAllItem } from "@velella/ebb";
import { formatCheckAllResult } from "../format.js";
import type { McpTool, McpToolResult } from "../types.js";
import { extractPurlAndVersion } from "./check.js";

export function normalizeBatchItems(rawList: unknown): CheckAllItem[] {
  if (!Array.isArray(rawList)) {
    return [];
  }

  const items: CheckAllItem[] = [];

  for (const raw of rawList) {
    if (typeof raw === "string") {
      const { purl, version } = extractPurlAndVersion(raw);
      items.push({ purl, version: version ?? "" });
    } else if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      const purlArg = typeof obj.purl === "string" ? obj.purl : "";
      const versionArg = typeof obj.version === "string" ? obj.version : undefined;
      const { purl, version } = extractPurlAndVersion(purlArg, versionArg);
      items.push({ purl, version: version ?? "" });
    }
  }

  return items;
}

export const checkAllTool: McpTool = {
  definition: {
    name: "check_all",
    description:
      "Check multiple package URLs (PURLs) or dependencies in batch against known end-of-life and deprecation dates.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            oneOf: [
              {
                type: "string",
                description: "PURL with embedded version e.g. 'pkg:npm/request@2.88.2'",
              },
              {
                type: "object",
                properties: {
                  purl: { type: "string" },
                  version: { type: "string" },
                },
                required: ["purl"],
              },
            ],
          },
          description: "List of package URLs (e.g. 'pkg:npm/request@2.88.2') or objects to check in batch.",
        },
        purls: {
          type: "array",
          items: {
            oneOf: [
              {
                type: "string",
                description: "PURL with embedded version e.g. 'pkg:npm/request@2.88.2'",
              },
              {
                type: "object",
                properties: {
                  purl: { type: "string" },
                  version: { type: "string" },
                },
                required: ["purl"],
              },
            ],
          },
          description: "Alias for items.",
        },
      },
    },
  },
  handler: (args: Record<string, unknown>): McpToolResult => {
    const rawList = Array.isArray(args.items) ? args.items : Array.isArray(args.purls) ? args.purls : null;
    if (!rawList) {
      return {
        content: [
          {
            type: "text",
            text: "Error: 'items' or 'purls' parameter is required and must be an array of package URLs or items.",
          },
        ],
        isError: true,
      };
    }

    try {
      const items = normalizeBatchItems(rawList);
      const rawResult = checkAll(items);
      const result = formatCheckAllResult(rawResult);

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
            text: `Error during batch check: ${message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
