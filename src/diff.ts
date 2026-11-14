/**
 * Compares two software lifecycle data versions, bundles, or rulesets and reports
 * added, changed, removed, and renamed rules with field-level delta tracking.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { BUNDLED_ECOSYSTEMS, type DataBundle } from "./data-bundle.js";
import {
  BUNDLE_FILE,
  cachedBundleDirectory,
  defaultCacheDirectory,
  resolveActiveData,
  type ActiveData,
  type DataSourceOptions,
} from "./data-source.js";
import { EbbError } from "./errors.js";
import type { RegistryV2Rule } from "./registry.js";
import { createColors, isColorSupported } from "./cli/format/color.js";

export const DATA_DIFF_SCHEMA_VERSION = "ebb.data-diff.v1" as const;

export class DiffError extends EbbError {
  constructor(message: string) {
    super("data-unavailable", message);
    this.name = "DiffError";
  }
}

export interface RuleFieldChange {
  readonly field: string;
  readonly from: unknown;
  readonly to: unknown;
  readonly shiftDays?: number | undefined;
  readonly description?: string | undefined;
}

export interface ChangedRuleDiff {
  readonly id: string;
  readonly ecosystem: string;
  readonly purl: string;
  readonly title: string;
  readonly changes: readonly RuleFieldChange[];
  readonly fromRule: RegistryV2Rule;
  readonly toRule: RegistryV2Rule;
}

export interface RenamedRuleDiff {
  readonly fromId: string;
  readonly toId: string;
  readonly ecosystem: string;
  readonly purl: string;
  readonly changes: readonly RuleFieldChange[];
  readonly fromRule: RegistryV2Rule;
  readonly toRule: RegistryV2Rule;
}

export interface DataDiffSummary {
  readonly totalFrom: number;
  readonly totalTo: number;
  readonly added: number;
  readonly changed: number;
  readonly removed: number;
  readonly renamed: number;
  readonly byEcosystem: Record<string, { added: number; changed: number; removed: number; renamed: number }>;
  readonly byEvent: Record<string, { added: number; changed: number; removed: number }>;
}

export interface DataDiffResult {
  readonly schemaVersion: typeof DATA_DIFF_SCHEMA_VERSION;
  readonly from: { description: string; version?: string | undefined };
  readonly to: { description: string; version?: string | undefined };
  readonly summary: DataDiffSummary;
  readonly added: readonly RegistryV2Rule[];
  readonly changed: readonly ChangedRuleDiff[];
  readonly removed: readonly RegistryV2Rule[];
  readonly renamed: readonly RenamedRuleDiff[];
}

export type DiffTarget =
  | string
  | DataBundle
  | { manifest?: Partial<DataBundle["manifest"]>; files?: Record<string, unknown>; rules?: readonly RegistryV2Rule[] }
  | Iterable<RegistryV2Rule>;

export interface DiffOptions extends DataSourceOptions {
  readonly ecosystem?: string | readonly string[] | undefined;
}

function extractRulesFromFiles(files: Record<string, Record<string, unknown>>): RegistryV2Rule[] {
  const rules: RegistryV2Rule[] = [];
  for (const [path, file] of Object.entries(files)) {
    if (path.startsWith("registry/") && path.endsWith(".json") && !path.endsWith("-shas.json")) {
      if (Array.isArray(file.rules)) {
        for (const rule of file.rules) {
          if (rule && typeof rule === "object" && typeof (rule as { id?: unknown }).id === "string") {
            rules.push(rule as RegistryV2Rule);
          }
        }
      }
    }
  }
  return rules;
}

async function extractAllRulesFromActiveData(active: ActiveData): Promise<RegistryV2Rule[]> {
  const rules: RegistryV2Rule[] = [];
  for (const eco of BUNDLED_ECOSYSTEMS) {
    try {
      const reg = (await active.read(`registry/${eco}.json`)) as Record<string, unknown>;
      if (Array.isArray(reg?.rules)) {
        for (const r of reg.rules) {
          if (r && typeof r === "object" && typeof (r as { id?: unknown }).id === "string") {
            rules.push(r as RegistryV2Rule);
          }
        }
      }
    } catch {
      // Ecosystem not present in this active data
    }
  }
  return rules;
}

interface ResolvedTarget {
  description: string;
  version?: string | undefined;
  rules: RegistryV2Rule[];
}

async function resolveTarget(
  target: DiffTarget | undefined,
  defaultName: "bundled" | "active",
  options: DiffOptions = {},
): Promise<ResolvedTarget> {
  const effective = target ?? defaultName;

  if (Array.isArray(effective)) {
    return { description: "custom rules", rules: effective as RegistryV2Rule[] };
  }

  if (typeof effective === "object" && effective !== null) {
    if ("rules" in effective && Array.isArray((effective as { rules: unknown }).rules)) {
      const manifest = (effective as { manifest?: { version?: string } }).manifest;
      return {
        description: manifest?.version ? `rules (${manifest.version})` : "custom rules",
        version: manifest?.version,
        rules: (effective as { rules: RegistryV2Rule[] }).rules,
      };
    }
    if ("files" in effective && typeof (effective as { files: unknown }).files === "object") {
      const files = (effective as { files: Record<string, Record<string, unknown>> }).files;
      const rules = extractRulesFromFiles(files);
      const manifest = (effective as { manifest?: { version?: string } }).manifest;
      return {
        description: manifest?.version ? `bundle ${manifest.version}` : "bundle object",
        version: manifest?.version,
        rules,
      };
    }
  }

  if (typeof effective === "string") {
    if (effective === "active") {
      const active = await resolveActiveData(options);
      const rules = await extractAllRulesFromActiveData(active);
      return {
        description: `active (${active.info.source}: ${active.info.version})`,
        version: active.info.version,
        rules,
      };
    }

    if (effective === "bundled") {
      const bundled = await resolveActiveData({ ...options, pinnedVersion: "bundled" });
      const rules = await extractAllRulesFromActiveData(bundled);
      return {
        description: `bundled (${bundled.info.version})`,
        version: bundled.info.version,
        rules,
      };
    }

    // ISO Date: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(effective)) {
      const active = await resolveActiveData(options);
      const allRules = await extractAllRulesFromActiveData(active);
      const dateRules = allRules.filter((r) => {
        const observed = r.provenance?.observedAt ?? r.provenance?.reviewedAt;
        return !observed || observed <= effective;
      });
      return {
        description: `as of ${effective}`,
        rules: dateRules,
      };
    }

    // File path
    if (
      effective.startsWith(".") ||
      effective.startsWith("/") ||
      effective.startsWith("~") ||
      effective.endsWith(".json") ||
      effective.endsWith(".json.gz") ||
      existsSync(effective)
    ) {
      try {
        const raw = await readFile(effective);
        let contentBytes: Uint8Array = raw;
        if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
          contentBytes = gunzipSync(raw);
        }
        const text = Buffer.from(contentBytes).toString("utf8");
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (parsed.files && typeof parsed.files === "object") {
          const files = parsed.files as Record<string, Record<string, unknown>>;
          const rules = extractRulesFromFiles(files);
          const manifest = parsed.manifest as { version?: string } | undefined;
          return {
            description: manifest?.version ? `file ${effective} (${manifest.version})` : `file ${effective}`,
            version: manifest?.version,
            rules,
          };
        }
        if (Array.isArray(parsed.rules)) {
          return { description: `file ${effective}`, rules: parsed.rules as RegistryV2Rule[] };
        }
      } catch (err) {
        throw new DiffError(`Could not read bundle file "${effective}": ${(err as Error).message}`);
      }
    }

    // Version string in cache or bundled
    const cache = options.cacheDirectory ?? defaultCacheDirectory();
    const versionDir = cachedBundleDirectory(cache, effective);
    try {
      const raw = await readFile(join(versionDir, BUNDLE_FILE));
      let contentBytes: Uint8Array = raw;
      if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
        contentBytes = gunzipSync(raw);
      }
      const parsed = JSON.parse(Buffer.from(contentBytes).toString("utf8")) as Record<string, unknown>;
      if (parsed.files && typeof parsed.files === "object") {
        const files = parsed.files as Record<string, Record<string, unknown>>;
        const rules = extractRulesFromFiles(files);
        return { description: `cached version ${effective}`, version: effective, rules };
      }
    } catch {
      const bundled = await resolveActiveData({ ...options, pinnedVersion: "bundled" });
      if (bundled.info.version === effective) {
        const rules = await extractAllRulesFromActiveData(bundled);
        return { description: `bundled (${effective})`, version: effective, rules };
      }
      throw new DiffError(`Data version "${effective}" was not found in cache (${versionDir}) or bundled releases.`);
    }
  }

  throw new DiffError(`Unsupported diff target: ${String(effective)}`);
}

function compareRuleFields(fromRule: RegistryV2Rule, toRule: RegistryV2Rule): RuleFieldChange[] {
  const changes: RuleFieldChange[] = [];

  // Deadline changes
  const fromDeadline = fromRule.deadline ?? null;
  const toDeadline = toRule.deadline ?? null;
  if (fromDeadline !== toDeadline) {
    let shiftDays: number | undefined;
    if (fromDeadline && toDeadline) {
      const fromMs = Date.parse(fromDeadline);
      const toMs = Date.parse(toDeadline);
      if (!Number.isNaN(fromMs) && !Number.isNaN(toMs)) {
        shiftDays = Math.round((toMs - fromMs) / 86_400_000);
      }
    }
    const description =
      shiftDays !== undefined
        ? shiftDays > 0
          ? `deadline extended by ${shiftDays} days (${fromDeadline} → ${toDeadline})`
          : `deadline advanced by ${Math.abs(shiftDays)} days (${fromDeadline} → ${toDeadline})`
        : `deadline changed: ${fromDeadline ?? "none"} → ${toDeadline ?? "none"}`;
    changes.push({ field: "deadline", from: fromDeadline, to: toDeadline, shiftDays, description });
  }

  // Event
  if (fromRule.event !== toRule.event) {
    changes.push({
      field: "event",
      from: fromRule.event,
      to: toRule.event,
      description: `event changed from ${fromRule.event} to ${toRule.event}`,
    });
  }

  // Vers
  if (fromRule.vers !== toRule.vers) {
    changes.push({
      field: "vers",
      from: fromRule.vers,
      to: toRule.vers,
      description: `version range changed from ${fromRule.vers} to ${toRule.vers}`,
    });
  }

  // Severity
  if (fromRule.severity !== toRule.severity) {
    changes.push({
      field: "severity",
      from: fromRule.severity,
      to: toRule.severity,
      description: `severity changed from ${fromRule.severity} to ${toRule.severity}`,
    });
  }

  // Replacement
  const fromRep = fromRule.replacement ?? null;
  const toRep = toRule.replacement ?? null;
  if (fromRep !== toRep) {
    changes.push({
      field: "replacement",
      from: fromRep,
      to: toRep,
      description: `replacement changed from ${fromRep ?? "none"} to ${toRep ?? "none"}`,
    });
  }

  // Title
  if (fromRule.title !== toRule.title) {
    changes.push({ field: "title", from: fromRule.title, to: toRule.title });
  }

  // Summary
  const fromSum = fromRule.summary ?? null;
  const toSum = toRule.summary ?? null;
  if (fromSum !== toSum) {
    changes.push({ field: "summary", from: fromSum, to: toSum });
  }

  // Sources
  const fromUrls = (fromRule.sources ?? []).map((s) => s.url).sort();
  const toUrls = (toRule.sources ?? []).map((s) => s.url).sort();
  if (JSON.stringify(fromUrls) !== JSON.stringify(toUrls)) {
    const addedUrls = toUrls.filter((u) => !fromUrls.includes(u));
    const removedUrls = fromUrls.filter((u) => !toUrls.includes(u));
    changes.push({
      field: "sources",
      from: fromUrls,
      to: toUrls,
      description: `sources updated (+${addedUrls.length}, -${removedUrls.length})`,
    });
  }

  // Provenance
  const fromProv = fromRule.provenance;
  const toProv = toRule.provenance;
  if (fromProv?.reviewer !== toProv?.reviewer || fromProv?.reviewedAt !== toProv?.reviewedAt) {
    changes.push({
      field: "provenance",
      from: fromProv,
      to: toProv,
      description: `review updated: ${fromProv?.reviewer ?? "none"} (${fromProv?.reviewedAt ?? "unreviewed"}) → ${toProv?.reviewer ?? "none"} (${toProv?.reviewedAt ?? "unreviewed"})`,
    });
  }

  return changes;
}

/**
 * Compares two sets of rules synchronously in memory.
 */
export function diffRules(
  fromRules: Iterable<RegistryV2Rule>,
  toRules: Iterable<RegistryV2Rule>,
  options: {
    fromLabel?: string | undefined;
    toLabel?: string | undefined;
    ecosystem?: string | readonly string[] | undefined;
  } = {},
): DataDiffResult {
  const ecoFilter = options.ecosystem
    ? Array.isArray(options.ecosystem)
      ? new Set(options.ecosystem)
      : new Set([options.ecosystem])
    : null;

  const filterEco = (rules: Iterable<RegistryV2Rule>): RegistryV2Rule[] => {
    const list: RegistryV2Rule[] = [];
    for (const r of rules) {
      if (!ecoFilter || ecoFilter.has(r.ecosystem)) {
        list.push(r);
      }
    }
    return list;
  };

  const fromList = filterEco(fromRules);
  const toList = filterEco(toRules);

  const fromMap = new Map<string, RegistryV2Rule>();
  for (const r of fromList) fromMap.set(r.id, r);

  const toMap = new Map<string, RegistryV2Rule>();
  for (const r of toList) toMap.set(r.id, r);

  const potentialAdded: RegistryV2Rule[] = [];
  const potentialRemoved: RegistryV2Rule[] = [];
  const changed: ChangedRuleDiff[] = [];
  const renamed: RenamedRuleDiff[] = [];

  for (const [id, toRule] of toMap) {
    const fromRule = fromMap.get(id);
    if (!fromRule) {
      potentialAdded.push(toRule);
    } else {
      const changes = compareRuleFields(fromRule, toRule);
      if (changes.length > 0) {
        changed.push({
          id,
          ecosystem: toRule.ecosystem,
          purl: toRule.purl,
          title: toRule.title,
          changes,
          fromRule,
          toRule,
        });
      }
    }
  }

  for (const [id, fromRule] of fromMap) {
    if (!toMap.has(id)) {
      potentialRemoved.push(fromRule);
    }
  }

  // Handle renamed rules: explicit aliases or identical purl + event + ecosystem
  const finalAdded: RegistryV2Rule[] = [];
  const handledRemoved = new Set<string>();

  for (const toRule of potentialAdded) {
    const renamedFromId =
      (toRule as { renamedFrom?: string }).renamedFrom ??
      ((toRule as unknown as Record<string, unknown>)["x-renamed-from"] as string | undefined);

    let matchedFrom: RegistryV2Rule | undefined;

    if (renamedFromId) {
      matchedFrom = potentialRemoved.find((r) => r.id === renamedFromId && !handledRemoved.has(r.id));
    }

    if (!matchedFrom) {
      matchedFrom = potentialRemoved.find(
        (r) =>
          !handledRemoved.has(r.id) &&
          r.purl === toRule.purl &&
          r.event === toRule.event &&
          r.ecosystem === toRule.ecosystem,
      );
    }

    if (matchedFrom) {
      handledRemoved.add(matchedFrom.id);
      const changes = compareRuleFields(matchedFrom, toRule);
      renamed.push({
        fromId: matchedFrom.id,
        toId: toRule.id,
        ecosystem: toRule.ecosystem,
        purl: toRule.purl,
        changes,
        fromRule: matchedFrom,
        toRule,
      });
    } else {
      finalAdded.push(toRule);
    }
  }

  const finalRemoved = potentialRemoved.filter((r) => !handledRemoved.has(r.id));

  const byEcosystem: Record<string, { added: number; changed: number; removed: number; renamed: number }> = {};
  const byEvent: Record<string, { added: number; changed: number; removed: number }> = {};

  const ensureEco = (eco: string) => {
    if (!byEcosystem[eco]) byEcosystem[eco] = { added: 0, changed: 0, removed: 0, renamed: 0 };
    return byEcosystem[eco]!;
  };
  const ensureEvent = (ev: string) => {
    if (!byEvent[ev]) byEvent[ev] = { added: 0, changed: 0, removed: 0 };
    return byEvent[ev]!;
  };

  for (const r of finalAdded) {
    ensureEco(r.ecosystem).added++;
    ensureEvent(r.event).added++;
  }
  for (const c of changed) {
    ensureEco(c.ecosystem).changed++;
    ensureEvent(c.toRule.event).changed++;
  }
  for (const r of finalRemoved) {
    ensureEco(r.ecosystem).removed++;
    ensureEvent(r.event).removed++;
  }
  for (const r of renamed) {
    ensureEco(r.ecosystem).renamed++;
  }

  const summary: DataDiffSummary = {
    totalFrom: fromList.length,
    totalTo: toList.length,
    added: finalAdded.length,
    changed: changed.length,
    removed: finalRemoved.length,
    renamed: renamed.length,
    byEcosystem,
    byEvent,
  };

  return {
    schemaVersion: DATA_DIFF_SCHEMA_VERSION,
    from: { description: options.fromLabel ?? "source data" },
    to: { description: options.toLabel ?? "target data" },
    summary,
    added: finalAdded,
    changed,
    removed: finalRemoved,
    renamed,
  };
}

/**
 * Compares two data versions, bundle files, dates, or active data and returns what changed.
 */
export async function diff(from?: DiffTarget, to?: DiffTarget, options: DiffOptions = {}): Promise<DataDiffResult> {
  const fromTarget = await resolveTarget(from, "bundled", options);
  const toTarget = await resolveTarget(to, "active", options);

  const result = diffRules(fromTarget.rules, toTarget.rules, {
    fromLabel: fromTarget.description,
    toLabel: toTarget.description,
    ecosystem: options.ecosystem,
  });

  return {
    ...result,
    from: { description: fromTarget.description, version: fromTarget.version },
    to: { description: toTarget.description, version: toTarget.version },
  };
}

/**
 * Formats data diff as Markdown suitable for release notes and documentation.
 */
export function formatDiffMarkdown(result: DataDiffResult): string {
  const { from, to, summary, added, changed, removed, renamed } = result;
  const lines: string[] = [];

  lines.push("# Ebb Lifecycle Data Diff");
  lines.push("");
  lines.push(`**From:** ${from.description}`);
  lines.push(`**To:** ${to.description}`);
  lines.push("");
  lines.push(
    `**Summary:** ${summary.added} added, ${summary.changed} changed, ${summary.removed} removed, ${summary.renamed} renamed (${summary.totalFrom} → ${summary.totalTo} total rules).`,
  );
  lines.push("");

  if (added.length > 0) {
    lines.push(`### Added Rules (${added.length})`);
    lines.push("");
    const byEco = new Map<string, RegistryV2Rule[]>();
    for (const r of added) {
      if (!byEco.has(r.ecosystem)) byEco.set(r.ecosystem, []);
      byEco.get(r.ecosystem)!.push(r);
    }
    for (const [eco, rules] of byEco) {
      lines.push(`#### ${eco}`);
      for (const r of rules) {
        const deadline = r.deadline ? ` (deadline: ${r.deadline})` : "";
        const rep = r.replacement ? ` → replacement: \`${r.replacement}\`` : "";
        lines.push(`- \`${r.id}\`: **${r.title}** [\`${r.vers}\`, ${r.event}]${deadline}${rep}`);
      }
      lines.push("");
    }
  }

  if (changed.length > 0) {
    lines.push(`### Changed Rules (${changed.length})`);
    lines.push("");
    for (const c of changed) {
      lines.push(`- \`${c.id}\` (${c.ecosystem}): **${c.title}**`);
      for (const ch of c.changes) {
        lines.push(`  - **${ch.field}**: ${ch.description ?? `${String(ch.from)} → ${String(ch.to)}`}`);
      }
    }
    lines.push("");
  }

  if (renamed.length > 0) {
    lines.push(`### Renamed Rules (${renamed.length})`);
    lines.push("");
    for (const r of renamed) {
      lines.push(`- \`${r.fromId}\` → \`${r.toId}\` (${r.ecosystem}): **${r.toRule.title}**`);
    }
    lines.push("");
  }

  if (removed.length > 0) {
    lines.push(`### Removed Rules (${removed.length})`);
    lines.push("");
    for (const r of removed) {
      lines.push(`- \`${r.id}\` (${r.ecosystem}): **${r.title}**`);
    }
    lines.push("");
  }

  if (summary.added === 0 && summary.changed === 0 && summary.removed === 0 && summary.renamed === 0) {
    lines.push("No changes between versions.");
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

/**
 * Formats data diff as ANSI-colored human-readable text for the CLI.
 */
export function formatDiffText(result: DataDiffResult, options: { color?: boolean } = {}): string {
  const useColor = options.color ?? isColorSupported();
  const c = createColors(useColor);
  const { from, to, summary, added, changed, removed, renamed } = result;

  const lines: string[] = [];
  lines.push(`ebb diff: ${from.description} → ${to.description}`);
  lines.push(
    `Summary: ${c.green(`+${summary.added}`)} added, ${c.yellow(`~${summary.changed}`)} changed, ${c.red(`-${summary.removed}`)} removed, ${c.cyan(`→${summary.renamed}`)} renamed (${summary.totalFrom} → ${summary.totalTo} total rules)`,
  );
  lines.push("");

  if (added.length > 0) {
    lines.push(c.green(`Added (${added.length}):`));
    for (const r of added) {
      const deadline = r.deadline ? ` (deadline: ${r.deadline})` : "";
      lines.push(`  ${c.green("+")} ${c.bold(r.id)} (${r.ecosystem}) [${r.event}]${deadline}`);
    }
    lines.push("");
  }

  if (changed.length > 0) {
    lines.push(c.yellow(`Changed (${changed.length}):`));
    for (const item of changed) {
      lines.push(`  ${c.yellow("~")} ${c.bold(item.id)} (${item.ecosystem})`);
      for (const ch of item.changes) {
        lines.push(`    ${c.dim(ch.field)}: ${ch.description ?? `${String(ch.from)} → ${String(ch.to)}`}`);
      }
    }
    lines.push("");
  }

  if (renamed.length > 0) {
    lines.push(c.cyan(`Renamed (${renamed.length}):`));
    for (const r of renamed) {
      lines.push(`  ${c.cyan("→")} ${r.fromId} → ${c.bold(r.toId)} (${r.ecosystem})`);
    }
    lines.push("");
  }

  if (removed.length > 0) {
    lines.push(c.red(`Removed (${removed.length}):`));
    for (const r of removed) {
      lines.push(`  ${c.red("-")} ${r.id} (${r.ecosystem})`);
    }
    lines.push("");
  }

  if (summary.added === 0 && summary.changed === 0 && summary.removed === 0 && summary.renamed === 0) {
    lines.push("No changes between versions.");
  }

  return lines.join("\n").trimEnd();
}
