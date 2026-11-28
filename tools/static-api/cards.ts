import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ReleaseLine } from "../../src/pick-version.js";
import { type EolPrediction, isDatedEnd } from "../../src/predict.js";
import type { RegistryV2Rule } from "../../src/registry.js";
import { releaseLineFromVers, ruleCoversLineRange } from "../../src/rule-versions.js";
import { CARD_MAX_BYTES, CARDS_MAX_BYTES, renderTimelineCard, type TimelineLine } from "../cards/render.js";
import { type ExpectedRuntime, loadExpectedRuntimes } from "../coverage/runtimes.js";

interface CardSchedules {
  nodejs: { source: string; maintenance: Record<string, string> };
  ubuntu: { source: string; lines: (TimelineLine & { released: string })[] };
}

export interface CardIndexEntry {
  path: string;
  sha256: string;
  bytes: number;
}

/** Loads only the checkout's published evidence so fixtures and alternate roots work offline. */
export async function loadCardEvidence(root: string) {
  const coverageDir = join(root, "tools/coverage/expected");
  const schedulesPath = join(root, "tools/cards/schedules.json");
  const [histories, schedules] = await Promise.all([
    existsSync(coverageDir) ? loadExpectedRuntimes(coverageDir) : [],
    existsSync(schedulesPath)
      ? readFile(schedulesPath, "utf8").then((raw) => JSON.parse(raw) as CardSchedules)
      : undefined,
  ]);
  return {
    histories: new Map<string, ExpectedRuntime>(histories.map((history) => [history.purl, history])),
    schedules,
  };
}

type CardOptions = {
  outDir: string;
  purl: string;
  name: string;
  componentPath: string;
  componentUrl: string;
  asOf: string;
  rules: readonly RegistryV2Rule[];
  releaseLines: readonly ReleaseLine[];
  predictions: readonly EolPrediction[];
  evidence: Awaited<ReturnType<typeof loadCardEvidence>>;
};

function lineDate(rule: RegistryV2Rule): string | undefined {
  for (const [key, value] of Object.entries(rule)) {
    if (!key.startsWith("x-") || !value || typeof value !== "object") continue;
    const month: unknown = value.endOfLifeMonth;
    if (typeof month === "string" && /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(month)) return month;
  }
  return rule.deadline;
}

export async function writeTimelineCard(options: CardOptions): Promise<CardIndexEntry | undefined> {
  const { purl, asOf, evidence, releaseLines, rules, predictions, componentUrl } = options;
  const history = evidence.histories.get(purl);
  const nodejs = purl === "pkg:generic/nodejs" ? evidence.schedules?.nodejs : undefined;
  const ubuntu = purl === "pkg:generic/ubuntu" ? evidence.schedules?.ubuntu : undefined;
  const source = ubuntu?.source ?? nodejs?.source ?? history?.scheduleUrl ?? componentUrl;
  const name = ubuntu ? "Ubuntu" : nodejs ? "Node.js" : options.name;
  const known = new Map<
    string,
    { id: string; vers: string; released?: string | undefined; end?: string | undefined }
  >();
  for (const line of releaseLines) {
    if (line.id !== "*") known.set(line.id, { id: line.id, vers: line.vers });
  }
  for (const line of history?.lines ?? []) {
    const key = releaseLineFromVers(line.lineVers)?.id ?? line.id;
    known.set(key, { id: line.id, vers: line.lineVers, released: line.firstReleased, end: line.end?.date });
  }
  for (const prediction of predictions) {
    const key = releaseLineFromVers(prediction.lineVers)?.id ?? prediction.line;
    if (!known.has(key)) known.set(key, { id: prediction.line, vers: prediction.lineVers });
  }

  const visibleRules = rules.filter(
    (rule) => rule.deadline && rule.provenance.observedAt <= asOf && !rule.usage?.some(({ kind }) => kind === "symbol"),
  );
  const lines: TimelineLine[] = ubuntu
    ? ubuntu.lines.filter(({ released }) => released <= asOf)
    : [...known.values()].flatMap(({ id, vers, released, end: inventoryEnd }) => {
        if (released && released > asOf) return [];
        const matching = visibleRules.filter((rule) => ruleCoversLineRange(rule.vers, vers));
        const dated = matching.filter(isDatedEnd);
        // Broad rules can suppress forecasts but can bundle several historical deadlines.
        const specificEnd = dated.find((rule) => rule.vers === vers || releaseLineFromVers(rule.vers)?.id === id);
        const end = (specificEnd ? lineDate(specificEnd) : undefined) ?? inventoryEnd;
        const active = matching.find(({ event }) => event === "end-of-active-support");
        const extended = matching.find(({ event }) => event === "end-of-extended-support");
        const activeEnd = nodejs?.maintenance[id] ?? (active ? lineDate(active) : undefined);
        const extendedEnd = extended ? lineDate(extended) : undefined;
        const prediction =
          end || dated.length
            ? undefined
            : predictions.find(
                (candidate) =>
                  candidate.predictedEnd.high >= (released ?? "") && ruleCoversLineRange(candidate.lineVers, vers),
              );
        return released || end || activeEnd || extendedEnd || prediction
          ? [{ id, released, end, activeEnd, extendedEnd, prediction }]
          : [];
      });
  if (!lines.length) return undefined;
  lines.sort((a, b) => b.id.localeCompare(a.id, "en", { numeric: true }));

  const path = `cards/${options.componentPath.replace(/\.json$/u, ".svg")}`;
  const svg = renderTimelineCard({ name, asOf, sourceUrl: source, lines });
  const bytes = Buffer.byteLength(svg);
  if (bytes > CARD_MAX_BYTES) throw new Error(`Timeline card ${path} exceeds ${CARD_MAX_BYTES} bytes: ${bytes}`);
  const file = join(options.outDir, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, svg, "utf8");
  return { path, sha256: createHash("sha256").update(svg).digest("hex"), bytes };
}

export function checkTotalCardSize(bytes: number): void {
  if (bytes > CARDS_MAX_BYTES) throw new Error(`Timeline cards exceed ${CARDS_MAX_BYTES} bytes: ${bytes}`);
}
