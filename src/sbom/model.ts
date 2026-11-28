import { check } from "../check.js";
import { resolveCandidateRules } from "../check-core.js";
import { PurlError, normalizePurl, parsePurl } from "../purl.js";
import type { LifecycleEvent } from "../registry.js";
import { VersError } from "../vers.js";

export type JsonRecord = Record<string, unknown>;

export interface SbomSummary {
  checked: number;
  enriched: number;
  notIdentified: string[];
}

export const ruleUrlPrefix = "https://velella.sh/ebb/api/v1/rules/";
const commentPrefix = "Ebb lifecycle: ";
const ownershipSeparator = "; Ebb fields: ";

export interface Evidence {
  event: LifecycleEvent;
  url: string;
  date?: string;
}

export function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function records(value: unknown, name: string): JsonRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isRecord)) throw new Error(`Invalid SBOM ${name}: expected objects.`);
  return value;
}

export function isEbbReference(url: unknown, comment: unknown): boolean {
  return (
    typeof url === "string" &&
    url.startsWith(ruleUrlPrefix) &&
    typeof comment === "string" &&
    comment.startsWith(commentPrefix)
  );
}

export function previousValue(reference: JsonRecord, key: string): string | undefined {
  const comment = reference.comment;
  if (typeof comment !== "string") return undefined;
  const fields = comment.split(ownershipSeparator)[1];
  const prefix = `${key}=`;
  return fields
    ?.split(",")
    .find((field) => field.startsWith(prefix))
    ?.slice(prefix.length);
}

export function evidenceComment(evidence: Evidence, added: string[] = []): string {
  const when = evidence.date ? ` (${evidence.date})` : "";
  const ownership = added.length ? `${ownershipSeparator}${added.join(",")}` : "";
  return `${commentPrefix}${evidence.event}${when}${ownership}`;
}

export function evidenceFor(component: JsonRecord, purl: unknown, version: unknown, summary: SbomSummary): Evidence[] {
  if (typeof purl === "string" && purl.startsWith("pkg:")) {
    try {
      const canonical = normalizePurl(purl);
      const parsed = parsePurl(canonical);
      const declared = typeof version === "string" && version ? version : undefined;
      const release = declared ?? parsed.version;
      if (release && (!declared || !parsed.version || declared === parsed.version)) {
        const matches = check(canonical, release).matches;
        const raw = new Map(resolveCandidateRules(canonical).map((rule) => [rule.id, rule.event]));
        const evidence = matches.flatMap((match): Evidence[] => {
          const event = raw.get(match.ruleId);
          if (!event) return [];
          const date = match.confidence === "confirmed" && match.datePrecision !== "month" ? match.date : null;
          return [
            { event, url: `${ruleUrlPrefix}${encodeURIComponent(match.ruleId)}.json`, ...(date ? { date } : {}) },
          ];
        });
        summary.checked++;
        if (evidence.length) summary.enriched++;
        return evidence;
      }
    } catch (err) {
      if (!(err instanceof PurlError || err instanceof VersError)) throw err;
    }
  }
  const name = component.name;
  summary.notIdentified.push(typeof name === "string" ? name : "(unnamed component)");
  return [];
}

export function isSupportDeadline(evidence: Evidence): boolean {
  return ["end-of-life", "scheduled-end-of-life", "end-of-support"].includes(evidence.event);
}
