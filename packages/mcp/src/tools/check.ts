import { check } from "@velella/ebb";
import type { McpTool, McpToolResult } from "../types.js";

export function extractPurlAndVersion(
  purlInput: string,
  explicitVersion?: string,
): { purl: string; version?: string | undefined } {
  const trimmedPurl = purlInput.trim();
  if (explicitVersion && explicitVersion.trim()) {
    const atIdx = trimmedPurl.lastIndexOf("@");
    const cleanPurl = atIdx !== -1 && trimmedPurl.toLowerCase().startsWith("pkg:")
      ? trimmedPurl.slice(0, atIdx)
      : trimmedPurl;
    return { purl: cleanPurl, version: explicitVersion.trim() };
  }

  const atIdx = trimmedPurl.lastIndexOf("@");
  if (atIdx !== -1 && trimmedPurl.toLowerCase().startsWith("pkg:")) {
    const cleanPurl = trimmedPurl.slice(0, atIdx);
    const ver = trimmedPurl.slice(atIdx + 1);
    return { purl: cleanPurl, version: ver || undefined };
  }

  return { purl: trimmedPurl, version: undefined };
}

export const checkTool: McpTool = {
  definition: {
    name: "check",
    description:
      "Check a package URL (PURL) or software product at a specific version against known end-of-life and deprecation dates.",
    inputSchema: {
      type: "object",
      properties: {
        purl: {
          type: "string",
          description:
            "Package URL (e.g. 'pkg:npm/request@2.88.2', 'pkg:npm/request', 'pkg:pypi/django@1.11') or bare product name (e.g. 'node', 'django').",
        },
        version: {
          type: "string",
          description:
            "Version string to check (e.g. '2.88.2'). If omitted, version embedded in the PURL is used.",
        },
        asOf: {
          type: "string",
          description: "Optional reference date in YYYY-MM-DD format to compute daysLeft relative to.",
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
    const asOfArg = typeof args.asOf === "string" ? args.asOf : undefined;

    const { purl, version } = extractPurlAndVersion(purlArg, explicitVersion);

    if (!version) {
      return {
        content: [
          {
            type: "text",
            text: `Error: A version is required to check "${purl}". Provide it in the PURL (e.g. "${purl}@<version>") or pass the "version" argument.`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = check(purl, version, asOfArg);
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
            text: `Error checking package: ${message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
