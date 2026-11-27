// Automated Source Healer pipeline (sub-issues 4, 5, 6, 7).
// Reads unreachable sources, finds relocations or archives, updates registry/lock, and opens PRs.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RegistryV2, RegistryV2Rule } from "../../src/registry.js";
import { findArchivedSnapshot } from "./archive.js";
import { findRelocatedSource } from "./relocate.js";

export const SOURCE_HEAL_SCHEMA = "ebb.source-heal.v1" as const;

export interface HealCandidate {
  type: "relocated" | "archive";
  url: string;
  method: string;
  dateFound: boolean;
  archivedAt?: string | undefined;
  snippetHash?: string | undefined;
}

export interface HealReport {
  schemaVersion: typeof SOURCE_HEAL_SCHEMA;
  healedAt: string;
  oldUrl: string;
  ruleIds?: string[] | undefined;
  failures: { timestamp: string; error: string }[];
  candidate: HealCandidate | null;
  decision: "relocate" | "archive" | "unresolved";
}

export interface HealOptions {
  registryDir?: string | undefined;
  lockPath?: string | undefined;
  dryRun?: boolean | undefined;
  maxPrs?: number | undefined;
  repo?: string | undefined;
  token?: string | undefined;
  fetchFn?: typeof fetch | undefined;
}

export function formatHealPrBody(report: HealReport, issueNumber?: number): string {
  const lines = [
    "## Automated Evidence Source Repair",
    "",
    `Heal decision: \`${report.decision}\` for \`${report.oldUrl}\``,
    "",
  ];
  if (issueNumber) {
    lines.push(`Fixes #${issueNumber}`);
    lines.push("");
  }
  lines.push("### Heal Report", "", "```json", JSON.stringify(report, null, 2), "```", "");
  lines.push(
    "> Note: No lifecycle dates, events, severity, or VERS ranges were modified. Reviewers must confirm candidate evidence.",
  );
  return lines.join("\n");
}

export async function healDeadSource(
  oldUrl: string,
  rules: RegistryV2Rule[],
  failures: { timestamp: string; error: string }[] = [],
  options: HealOptions = {},
): Promise<HealReport> {
  const deadline = rules.find((r) => r.deadline)?.deadline;

  // 1. Try relocation
  const relocateRes = await findRelocatedSource(oldUrl, {
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
    ...(options.token ? { token: options.token } : {}),
    ...(deadline ? { deadline } : {}),
  });

  if (relocateRes.relocated && relocateRes.newUrl && relocateRes.dateFound) {
    return {
      schemaVersion: SOURCE_HEAL_SCHEMA,
      healedAt: new Date().toISOString(),
      oldUrl,
      ruleIds: rules.map((r) => r.id),
      failures,
      candidate: {
        type: "relocated",
        url: relocateRes.newUrl,
        method: relocateRes.method ?? "http-redirect",
        dateFound: true,
      },
      decision: "relocate",
    };
  }

  // 2. Try Wayback archive
  const archiveRes = await findArchivedSnapshot(oldUrl, {
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
    ...(deadline ? { deadline } : {}),
  });

  if (archiveRes.found && archiveRes.archiveUrl && archiveRes.dateFound) {
    return {
      schemaVersion: SOURCE_HEAL_SCHEMA,
      healedAt: new Date().toISOString(),
      oldUrl,
      ruleIds: rules.map((r) => r.id),
      failures,
      candidate: {
        type: "archive",
        url: archiveRes.archiveUrl,
        method: "wayback-availability",
        dateFound: true,
        ...(archiveRes.archivedAt ? { archivedAt: archiveRes.archivedAt } : {}),
      },
      decision: "archive",
    };
  }

  return {
    schemaVersion: SOURCE_HEAL_SCHEMA,
    healedAt: new Date().toISOString(),
    oldUrl,
    ruleIds: rules.map((r) => r.id),
    failures,
    candidate: null,
    decision: "unresolved",
  };
}

export async function applyHealToRegistry(
  report: HealReport,
  registryDir: string,
): Promise<{ modifiedFiles: string[] }> {
  const modifiedFiles: string[] = [];
  const entries = await readdir(registryDir);
  for (const entry of entries) {
    if (!entry.endsWith(".json") || entry === "sources.lock.json") continue;
    const filePath = join(registryDir, entry);
    const content = await readFile(filePath, "utf8");
    const reg = JSON.parse(content) as RegistryV2;
    let modified = false;

    for (const rule of reg.rules) {
      for (const src of rule.sources) {
        if (src.url === report.oldUrl) {
          if (report.decision === "relocate" && report.candidate) {
            src.url = report.candidate.url;
            modified = true;
          } else if (report.decision === "archive" && report.candidate) {
            src.archiveUrl = report.candidate.url;
            if (report.candidate.archivedAt) {
              src.archivedAt = report.candidate.archivedAt;
            }
            modified = true;
          }
        }
      }
    }

    if (modified) {
      await writeFile(filePath, `${JSON.stringify(reg, null, 2)}\n`);
      modifiedFiles.push(filePath);
    }
  }
  return { modifiedFiles };
}
