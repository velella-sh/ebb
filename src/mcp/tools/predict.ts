import { predictEol } from "../../predict.js";
import type { McpTool } from "../types.js";

export const predictTool: McpTool = {
  definition: {
    name: "predict_eol",
    description:
      'Call when an unannounced end-of-life date needs a planning estimate. Returns a predicted range, confidence and sources. Example: {"purl":"pkg:generic/golang","version":"1.26.0"}.',
    inputSchema: {
      type: "object",
      properties: { purl: { type: "string" }, version: { type: "string" } },
      required: ["purl", "version"],
    },
    outputSchema: {
      type: "object",
      properties: { prediction: { type: ["object", "null"] } },
      required: ["prediction"],
    },
  },
  handler({ purl, version }) {
    try {
      if (typeof purl !== "string" || typeof version !== "string" || !version.trim()) {
        throw new Error("A PURL and a version are required.");
      }
      const result = { prediction: predictEol(purl, version.trim()) };
      return {
        isError: false,
        structuredContent: result,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      };
    }
  },
};
