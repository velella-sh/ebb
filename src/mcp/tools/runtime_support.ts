import { firstSupporting, supports } from "../../compat.js";
import type { McpTool, McpToolResult } from "../types.js";

export const runtimeSupportTool: McpTool = {
  definition: {
    name: "runtime_support",
    description:
      'Call to find the first known framework version compatible with a runtime, or to check a specific release. Example: {"purl":"pkg:pypi/django","runtimePurl":"pkg:generic/python","runtimeVersion":"3.13"}.',
    inputSchema: {
      type: "object",
      properties: {
        purl: { type: "string", description: "Package URL of the framework, library, or tool." },
        version: { type: "string", description: "Omit to find the lowest release with recorded support." },
        runtimePurl: { type: "string", description: "Package URL of the runtime or requirement." },
        runtimeVersion: { type: "string", description: "Version of the runtime or requirement." },
      },
      required: ["purl", "runtimePurl", "runtimeVersion"],
    },
    outputSchema: {
      type: "object",
      properties: {
        status: { enum: ["supported", "not-supported", "unknown"] },
        version: { type: "string" },
        row: { type: "object" },
      },
      required: ["status"],
    },
  },
  handler: ({ purl, version, runtimePurl, runtimeVersion }): McpToolResult => {
    try {
      if (
        typeof purl !== "string" ||
        !purl ||
        typeof runtimePurl !== "string" ||
        !runtimePurl ||
        typeof runtimeVersion !== "string" ||
        !runtimeVersion ||
        (version !== undefined && (typeof version !== "string" || !version))
      ) {
        throw new Error(
          "purl, runtimePurl, and runtimeVersion must be non-empty strings, as must version when supplied.",
        );
      }
      const result =
        version === undefined
          ? firstSupporting(purl, runtimePurl, runtimeVersion)
          : supports(purl, version, runtimePurl, runtimeVersion);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };
    }
  },
};
