import { asOf, check } from "../../index.js";
import { formatCheckResult } from "../format.js";
import { canonicalRuleUrl } from "../../site-routes.js";
import type { McpTool, McpToolResult } from "../types.js";
import { isIsoDate } from "../../registry.js";
import { resolveCandidateRules } from "../../check-core.js";
import { purlToEcosystems } from "../../data/load.js";
import { loadDataFileSync } from "../../data-source.js";

export function extractPurlAndVersion(
  purlInput: string,
  explicitVersion?: string,
): { purl: string; version?: string | undefined } {
  const trimmedPurl = purlInput.trim();
  if (explicitVersion && explicitVersion.trim()) {
    const atIdx = trimmedPurl.lastIndexOf("@");
    const cleanPurl =
      atIdx !== -1 && trimmedPurl.toLowerCase().startsWith("pkg:") ? trimmedPurl.slice(0, atIdx) : trimmedPurl;
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

function getEcosystemRuleCount(purl: string): { ecosystem: string; count: number } {
  try {
    const ecosystems = purlToEcosystems(purl);
    const primary = ecosystems[0] ?? "unknown";
    if (primary && primary !== "unknown") {
      const data = loadDataFileSync(`registry/${primary}.json`) as { rules?: unknown[] };
      return { ecosystem: primary, count: data.rules?.length ?? 0 };
    }
  } catch {
    // fallback if data cannot be loaded
  }
  return { ecosystem: "unknown", count: 0 };
}

export const checkTool: McpTool = {
  definition: {
    name: "check",
    description:
      'Call before installing or upgrading a package or runtime version. Checks against known end-of-life and deprecation dates. Example: {"purl":"pkg:npm/request@2.88.2"}.',
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
          description: "Version string to check (e.g. '2.88.2'). If omitted, version embedded in the PURL is used.",
        },
        as_of: {
          type: "string",
          description: "Optional reference date in YYYY-MM-DD format to compute daysLeft relative to.",
        },
        asOf: {
          type: "string",
          description: "Alias for as_of.",
        },
      },
      required: ["purl"],
    },
    outputSchema: {
      type: "object",
      properties: {
        schemaVersion: { type: "number" },
        status: { type: "string" },
        version: { type: "string" },
        purl: { type: "string" },
        asOf: { type: "string" },
        dataVersion: { type: "string" },
        matches: {
          type: "array",
          items: { type: "object", properties: { canonicalUrl: { type: "string", format: "uri" } } },
        },
        provenance: { type: "object" },
        message: { type: "string" },
        ecosystem: { type: "string" },
        ecosystemRules: { type: "number" },
        verificationAdvice: { type: "string" },
      },
      required: ["status", "matches"],
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
    const asOfArg =
      typeof args.as_of === "string" ? args.as_of.trim() : typeof args.asOf === "string" ? args.asOf.trim() : undefined;

    if (asOfArg !== undefined && !isIsoDate(asOfArg)) {
      return {
        content: [
          {
            type: "text",
            text: `Error: 'as_of' must be a valid date (YYYY-MM-DD), got "${asOfArg}".`,
          },
        ],
        isError: true,
      };
    }

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
      const rawResult = asOfArg ? asOf(asOfArg).check(purl, version) : check(purl, version);
      const formatted = formatCheckResult(rawResult);
      const result = {
        ...formatted,
        matches: formatted.matches.map((match) => {
          const canonicalUrl = canonicalRuleUrl(match.ruleId);
          return canonicalUrl ? { ...match, canonicalUrl } : match;
        }),
      };

      let isUnknown = false;
      let ecoInfo = { ecosystem: "unknown", count: 0 };
      if (rawResult.matches.length === 0) {
        try {
          const candidates = resolveCandidateRules(purl);
          if (candidates.length === 0) {
            isUnknown = true;
            ecoInfo = getEcosystemRuleCount(purl);
          }
        } catch {
          // Keep standard result
        }
      }

      if (isUnknown) {
        const unknownMessage = `Ebb has no rule for this component (${purl}). This is not proof of support. Ebb knows ${ecoInfo.count} rules for the ${ecoInfo.ecosystem} ecosystem.`;
        const structured = {
          ...result,
          status: "unknown",
          message: unknownMessage,
          ecosystem: ecoInfo.ecosystem,
          ecosystemRules: ecoInfo.count,
        };
        const textPayload = {
          ...result,
          message: unknownMessage,
          ecosystem: ecoInfo.ecosystem,
          ecosystemRules: ecoInfo.count,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(textPayload, null, 2),
            },
          ],
          structuredContent: structured as unknown as Record<string, unknown>,
          isError: false,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
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
