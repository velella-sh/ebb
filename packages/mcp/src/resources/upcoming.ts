import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpResource, McpResourceResult } from "../types.js";

export interface UpcomingEvent {
  ruleId: string;
  purl: string;
  event: string;
  deadline: string;
  daysLeft: number;
  replacement: string | null;
  sources: Array<{ url: string }>;
  reviewedAt: string | null;
}

export interface UpcomingResult {
  asOf: string;
  count: number;
  events: UpcomingEvent[];
}

function findRegistryDirectory(): string {
  const candidates = [
    resolve(process.cwd(), "registry"),
    fileURLToPath(new URL("../../../../registry", import.meta.url)),
    fileURLToPath(new URL("../../../registry", import.meta.url)),
  ];

  for (const cand of candidates) {
    if (existsSync(cand) && statSync(cand).isDirectory()) {
      return cand;
    }
  }

  try {
    const pkgJsonPath = createRequire(import.meta.url).resolve("@velella/ebb/package.json");
    const regPath = resolve(dirname(pkgJsonPath), "registry");
    if (existsSync(regPath)) {
      return regPath;
    }
  } catch {
    // Ignore resolution errors
  }

  return resolve(process.cwd(), "registry");
}

function daysBetween(fromIsoDate: string, targetIsoDate: string): number {
  const fromMs = Date.parse(`${fromIsoDate}T00:00:00Z`);
  const targetMs = Date.parse(`${targetIsoDate}T00:00:00Z`);
  return Math.round((targetMs - fromMs) / (1000 * 60 * 60 * 24));
}

export function loadUpcomingEvents(options?: { asOf?: string | undefined }): UpcomingResult {
  const asOf = options?.asOf ?? new Date().toISOString().slice(0, 10);
  const regDir = findRegistryDirectory();

  if (!existsSync(regDir)) {
    return { asOf, count: 0, events: [] };
  }

  const files = readdirSync(regDir).filter(
    (file) => file.endsWith(".json") && !file.includes("lock") && !file.includes("shas"),
  );

  const events: UpcomingEvent[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(resolve(regDir, file), "utf8");
      const data = JSON.parse(content) as { rules?: Array<Record<string, unknown>> };
      for (const rule of data.rules ?? []) {
        const deadline = typeof rule.deadline === "string" ? rule.deadline : undefined;
        // Do not expose expired events (deadline < asOf)
        if (!deadline || deadline < asOf) {
          continue;
        }

        const ruleId = typeof rule.id === "string" ? rule.id : "";
        const purl = typeof rule.purl === "string" ? rule.purl : "";
        const event = typeof rule.event === "string" ? rule.event : "";
        const replacement = typeof rule.replacement === "string" ? rule.replacement : null;
        const sources = Array.isArray(rule.sources)
          ? (rule.sources as Array<{ url: string }>)
          : [];
        const provenance = typeof rule.provenance === "object" && rule.provenance !== null
          ? (rule.provenance as { reviewedAt?: string })
          : undefined;

        events.push({
          ruleId,
          purl,
          event,
          deadline,
          daysLeft: daysBetween(asOf, deadline),
          replacement,
          sources,
          reviewedAt: provenance?.reviewedAt ?? null,
        });
      }
    } catch {
      // Continue on file read error
    }
  }

  // Sort earliest deadline first, then rule id
  events.sort((a, b) => a.deadline.localeCompare(b.deadline) || a.ruleId.localeCompare(b.ruleId));

  return {
    asOf,
    count: events.length,
    events,
  };
}

export const upcomingResource: McpResource = {
  definition: {
    uri: "ebb://upcoming",
    name: "Upcoming software end-of-life and deprecations",
    description: "Scheduled software deprecation and end-of-life dates that have not yet occurred.",
    mimeType: "application/json",
  },
  handler: (rawUri: string): McpResourceResult => {
    let asOf: string | undefined;
    try {
      const parsedUrl = new URL(rawUri);
      const queryAsOf = parsedUrl.searchParams.get("asOf");
      if (queryAsOf) {
        asOf = queryAsOf;
      }
    } catch {
      // Not a valid URL with search params, use default asOf
    }

    const result = loadUpcomingEvents({ asOf });

    return {
      contents: [
        {
          uri: rawUri,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};
