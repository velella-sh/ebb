import { purlIdentity } from "../../src/purl.js";
import type { RegistryV2Rule } from "../../src/registry.js";
import { stale } from "../../src/stale.js";
import { evidenceUrl } from "../new-rule-source.js";
import { issueField } from "../new-product-triage.js";
import { auditSuccessors, compareText, markdownText } from "../successors-audit.js";
import { assessRuntime, type ExpectedRuntime } from "./runtimes.js";

export const productForm = "https://github.com/velella-sh/ebb/issues/new?template=new-product.yml";
export const gapKinds = ["runtime-line", "text-successor", "stale-rule", "dead-source", "requested-product"] as const;
type GapKind = (typeof gapKinds)[number];

export interface ProductRequest {
  number: number;
  title: string;
  body: string | null;
}
export interface Gap {
  kind: GapKind;
  key: string;
  component: string;
  reason: string;
  ruleId?: string;
  evidence?: string;
  request?: string;
}
export interface SourceHealth {
  status: string;
  archived: boolean;
}

interface Inputs {
  asOf: string;
  rules: readonly RegistryV2Rule[];
  runtimes: readonly ExpectedRuntime[];
  freshness: Readonly<Record<string, number>>;
  sources: ReadonlyMap<string, SourceHealth>;
  requests?: readonly ProductRequest[] | undefined;
}

function https(input: string): string | undefined {
  try {
    return evidenceUrl(input).href;
  } catch {
    return undefined;
  }
}

export function buildGaps({ asOf, rules, runtimes, freshness, sources, requests }: Inputs) {
  const gaps: Gap[] = [];
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const components = new Set(rules.map(({ purl }) => purlIdentity(purl)));

  for (const runtime of runtimes) {
    if (runtime.reviewedAt > asOf) continue;
    const matching = rules.filter(({ purl }) => purlIdentity(purl) === purlIdentity(runtime.purl));
    for (const gap of assessRuntime(runtime, matching).gaps) {
      gaps.push({
        kind: "runtime-line",
        key: `${runtime.runtime}/${gap.line}/${gap.kind}`,
        component: `${runtime.runtime} ${gap.line}`,
        reason: gap.detail,
        evidence: runtime.scheduleUrl,
      });
    }
  }

  for (const row of auditSuccessors(rules).rows) {
    const evidence = byId.get(row.ruleId)?.sources[0]?.url;
    gaps.push({
      kind: "text-successor",
      key: row.ruleId,
      component: row.purl,
      ruleId: row.ruleId,
      reason: `Text-only guidance (${row.classification}) — ${row.replacement}`,
      ...(evidence ? { evidence } : {}),
    });
  }

  for (const finding of stale({ asOf, rules, maxReviewAgeDays: freshness }).stale) {
    const evidence = byId.get(finding.ruleId)?.sources[0]?.url;
    gaps.push({
      kind: "stale-rule",
      key: finding.ruleId,
      component: finding.purl,
      ruleId: finding.ruleId,
      reason: `Last reviewed ${finding.reviewedAt}; ${finding.ageDays} days old, above the ${finding.maxReviewAgeDays}-day review window.`,
      ...(evidence ? { evidence } : {}),
    });
  }

  const dead = new Set<string>();
  for (const rule of [...rules].sort((a, b) => compareText(a.id, b.id))) {
    for (const source of rule.sources) {
      if (dead.has(source.url) || !["unreachable", "archived-only"].includes(sources.get(source.url)?.status ?? ""))
        continue;
      dead.add(source.url);
      gaps.push({
        kind: "dead-source",
        key: source.url,
        component: rule.purl,
        ruleId: rule.id,
        reason:
          "The source lock records the original URL as unreachable or archive-only. Check the vendor’s current evidence.",
        evidence: source.url,
      });
    }
  }

  let unresolvedRequests = 0;
  for (const issue of requests ?? []) {
    let product: string;
    const body = issue.body ?? "";
    try {
      const response = issueField(body, "Package URL (purl)").replace(/^`(.*)`$/su, "$1");
      product = purlIdentity(response);
    } catch {
      unresolvedRequests++;
      continue;
    }
    if (components.has(product)) continue;
    const evidence = https(issueField(body, "Authoritative Evidence URL"));
    gaps.push({
      kind: "requested-product",
      key: String(issue.number),
      component: product,
      reason: issue.title,
      request: `https://github.com/velella-sh/ebb/issues/${issue.number}`,
      ...(evidence ? { evidence } : {}),
    });
  }

  return {
    entries: gaps.sort((a, b) => gapKinds.indexOf(a.kind) - gapKinds.indexOf(b.kind) || compareText(a.key, b.key)),
    requestsAvailable: requests !== undefined,
    unresolvedRequests,
  };
}

const kindLabels: Record<GapKind, string> = {
  "runtime-line": "Runtime release lines",
  "text-successor": "Text-only successors",
  "stale-rule": "Rules due for review",
  "dead-source": "Unreachable evidence",
  "requested-product": "Requested products without rules",
};
const link = (label: string, url: string) =>
  `[${label}](${url.replace(/[<>()|]/gu, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase())})`;

export function renderGaps(gaps: ReturnType<typeof buildGaps>, date: string, version: string): string {
  const lines = [`Reference date ${date} UTC · Signed data ${version}`, ""];
  for (const kind of gapKinds) {
    if (kind === "requested-product" && !gaps.requestsAvailable) continue;
    const entries = gaps.entries.filter((entry) => entry.kind === kind);
    lines.push(`## ${kindLabels[kind]} (${entries.length})`, "");
    if (!entries.length) lines.push("No gaps were recorded in this category.", "");
    else {
      lines.push("| Component | Reason | Starting evidence | Contribution |", "| --- | --- | --- | --- |");
      for (const gap of entries) {
        const rule = gap.ruleId ? ` · Rule \`${gap.ruleId}\`` : "";
        const source = gap.evidence && https(gap.evidence);
        const evidence = source ? link("Source", source) : "—";
        const issue = gap.request ? ` · ${link("Existing request", gap.request)}` : "";
        lines.push(
          `| ${markdownText(gap.component)} | ${markdownText(gap.reason)}${rule} | ${evidence} | ${link("New product form", productForm)}${issue} |`,
        );
      }
      lines.push("");
    }
  }
  if (!gaps.requestsAvailable) lines.push("Open product requests were unavailable for this build.", "");
  else if (gaps.unresolvedRequests)
    lines.push(
      `${gaps.unresolvedRequests} open request(s) need a canonical package URL before coverage can be checked.`,
      "",
    );
  return lines.join("\n");
}
