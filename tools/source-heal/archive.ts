// Queries Wayback Machine availability API for dead source recovery (sub-issue 6).
// Ensures snapshots exist and contain the required lifecycle date.

import { containsDate } from "../source-date.js";
import { WAYBACK_AVAILABILITY_BASE } from "../archive-sources.js";

export interface WaybackSnapshot {
  url: string;
  timestamp: string;
  status: string;
}

export interface ArchiveMatchResult {
  found: boolean;
  archiveUrl?: string | undefined;
  archivedAt?: string | undefined;
  dateFound: boolean;
  reason?: string | undefined;
}

export interface ArchiveQueryOptions {
  fetchFn?: typeof fetch | undefined;
  availabilityBaseUrl?: string | undefined;
  deadline?: string | undefined;
}

/** Queries Wayback Availability API for closest snapshot before failure date */
export async function findArchivedSnapshot(
  targetUrl: string,
  options: ArchiveQueryOptions = {},
): Promise<ArchiveMatchResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const baseUrl = options.availabilityBaseUrl ?? WAYBACK_AVAILABILITY_BASE;
  const queryUrl = `${baseUrl}?url=${encodeURIComponent(targetUrl)}`;

  try {
    const res = await fetchFn(queryUrl);
    if (!res.ok) {
      return { found: false, dateFound: false, reason: `Wayback API HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      archived_snapshots?: {
        closest?: {
          available: boolean;
          url: string;
          timestamp: string;
          status: string;
        };
      };
    };

    const closest = data.archived_snapshots?.closest;
    if (!closest || !closest.available || !closest.url) {
      return { found: false, dateFound: false, reason: "No snapshot available" };
    }

    const archiveUrl = closest.url;
    // Format timestamp YYYY-MM-DD
    const ts = closest.timestamp;
    const archivedAt =
      ts && ts.length >= 8
        ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
        : new Date().toISOString().slice(0, 10);

    // If deadline is required, fetch snapshot content and check for date
    if (options.deadline) {
      const snapRes = await fetchFn(archiveUrl);
      if (!snapRes.ok) {
        return { found: true, archiveUrl, archivedAt, dateFound: false, reason: `Snapshot HTTP ${snapRes.status}` };
      }
      const text = await snapRes.text();
      const hasDate = containsDate(text, options.deadline);
      if (!hasDate) {
        return {
          found: true,
          archiveUrl,
          archivedAt,
          dateFound: false,
          reason: `Snapshot does not contain required deadline ${options.deadline}`,
        };
      }
    }

    return {
      found: true,
      archiveUrl,
      archivedAt,
      dateFound: true,
    };
  } catch (err) {
    return { found: false, dateFound: false, reason: (err as Error).message };
  }
}
