import { replacementFor } from "@velella/ebb";
import type { McpTool, McpToolResult } from "../types.js";
import { extractPurlAndVersion } from "./check.js";

export const replacementForTool: McpTool = {
  definition: {
    name: "replacement_for",
    description:
      "Get the recommended replacement package or migration target for a deprecated or end-of-life component version.",
    inputSchema: {
      type: "object",
      properties: {
        purl: {
          type: "string",
          description:
            "Package URL (e.g. 'pkg:npm/request@2.88.2', 'pkg:npm/request') or bare product name (e.g. 'node', 'django').",
        },
        version: {
          type: "string",
          description:
            "Version string (e.g. '2.88.2'). If omitted, version embedded in the PURL is used.",
        },
      },
      required: ["purl"],
    },
  },
  handler: (args: Record<string, unknown>): McpToolResult => {
    const purlArg = typeof args.purl === "string" ? args.purl : "";
    if (!purlArg.trim()) {
      return {
        content: [
          {
            type: "text",
            text: "Error: 'purl' parameter is required and must not be empty.",
          },
        ],
        isError: true,
      };
    }

    const explicitVersion = typeof args.version === "string" ? args.version : undefined;
    const { purl, version } = extractPurlAndVersion(purlArg, explicitVersion);

    if (!version) {
      return {
        content: [
          {
            type: "text",
            text: `Error: A version is required to find a replacement for "${purl}". Provide it in the PURL (e.g. "${purl}@<version>") or pass the "version" argument.`,
          },
        ],
        isError: true,
      };
    }

    try {
      const replacement = replacementFor(purl, version);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                purl,
                version,
                replacement,
              },
              null,
              2,
            ),
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
            text: `Error finding replacement: ${message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
