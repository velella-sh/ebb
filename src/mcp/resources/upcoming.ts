import { upcoming } from "../../index.js";
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

export function loadUpcomingEvents(options?: {
  asOf?: string | undefined;
  within?: string | number | undefined;
  ecosystem?: string | readonly string[] | undefined;
}): UpcomingResult {
  const asOf = options?.asOf ?? new Date().toISOString().slice(0, 10);
  const within = options?.within ?? "10y";
  const res = upcoming({ asOf, within, ecosystem: options?.ecosystem });

  return {
    asOf: res.asOf,
    count: res.count,
    events: res.items.map((it) => ({
      ruleId: it.ruleId,
      purl: it.purl,
      event: it.event,
      deadline: it.deadline,
      daysLeft: it.daysLeft,
      replacement: it.replacement,
      sources: it.sources.map((s) => ({ url: s.url })),
      reviewedAt: it.reviewedAt,
    })),
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
    let within: string | undefined;
    let ecosystem: string | undefined;

    try {
      const parsedUrl = new URL(rawUri);
      const queryAsOf = parsedUrl.searchParams.get("asOf");
      if (queryAsOf) {
        asOf = queryAsOf;
      }
      const queryWithin = parsedUrl.searchParams.get("within");
      if (queryWithin) {
        within = queryWithin;
      }
      const queryEcosystem = parsedUrl.searchParams.get("ecosystem");
      if (queryEcosystem) {
        ecosystem = queryEcosystem;
      }
    } catch {
      // Not a valid URL with search params, use defaults
    }

    const result = loadUpcomingEvents({ asOf, within, ecosystem });

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
