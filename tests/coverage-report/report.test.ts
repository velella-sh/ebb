import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { archiveWeeks, type CoverageWeek, loadWeeks } from "../../tools/coverage/history.js";
import { buildCoverage, renderCoverage } from "../../tools/coverage/report.js";
import { asOf, dataVersion, newSource, oldSource, rule } from "./fixture.js";

const args = {
  asOf,
  dataVersion,
  bundleSha256: "a".repeat(64),
  checkout: "b".repeat(40),
  lockSha256: "c".repeat(64),
  sourceLock: {
    [oldSource]: {
      checkedAt: "2026-11-27",
      status: "ok" as const,
      archiveUrl: "https://archive.example/copy",
      archivedAt: "2026-11-27",
    },
    [newSource]: { checkedAt: "2026-11-29", status: "unreachable" as const },
  },
  runtimes: [],
  freshness: { nodejs: 365, other: 365 },
  rules: [
    rule("first"),
    rule("second", {
      event: "deprecated",
      confidence: "tentative",
      deadline: "2026-11-27",
      sources: [{ title: "Later observation", url: newSource }],
    }),
    rule("third", { ecosystem: "other" }),
  ],
};

test("deterministic report metrics use unique components and sources, dated observations and review denominators", () => {
  const report = buildCoverage(args);
  assert.deepEqual(report.totals, {
    components: 1,
    rules: 3,
    byEvent: { deprecated: 1, "scheduled-end-of-life": 2 },
    futureDated: 2,
    byConfidence: { confirmed: 2, tentative: 1 },
    medianReviewDays: 27,
    reviewsWithDates: 3,
    sources: 2,
    bySourceStatus: { ok: 1, unknown: 1 },
    archivedSources: 1,
  });
  assert.deepEqual(
    report.ecosystems.map(({ ecosystem, sources }) => [ecosystem, sources]),
    [
      ["nodejs", 2],
      ["other", 1],
    ],
  );
  assert.equal(report.headline.week, "2026-11-23");
  assert.equal(report.headline.requestsAvailable, false);
  assert.equal(JSON.stringify(report), JSON.stringify(buildCoverage({ ...args, rules: [...args.rules].reverse() })));
  const body = renderCoverage(report, [report.headline]);
  assert.match(body, /3 rules · 1 components · 0 recorded gaps/u);
  assert.match(body, /Archived evidence was recorded for 1 of them/u);
  assert.equal(body, renderCoverage(buildCoverage(args), [report.headline]));
});

test("append-only history carries two fixture weeks without replacing the first captured week", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ebb-coverage-history-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const report = buildCoverage(args);
  const previous: CoverageWeek = { ...report.headline, week: "2026-11-16", asOf: "2026-11-19", rules: 2, gaps: 1 };
  const earlierFile = join(directory, "2026-11-16.json");
  await writeFile(earlierFile, JSON.stringify(previous, null, 2) + "\n");
  const original = await readFile(earlierFile);
  const weeks = await archiveWeeks(directory, await loadWeeks([directory]), report.headline);
  assert.deepEqual(
    weeks.map(({ week }) => week),
    ["2026-11-16", "2026-11-23"],
  );
  assert.deepEqual(await readFile(earlierFile), original);
  const body = renderCoverage(report, weeks);
  assert.match(body, /2026-11-16 \| 2026.11.11 \| 2 \| 1 \| 1/u);
  assert.match(body, /2026-11-23 \| 2026.11.11 \| 3 \| 1 \| 0/u);
  const repeated = await archiveWeeks(directory, await loadWeeks([directory]), { ...report.headline, gaps: 9 });
  assert.equal(repeated.at(-1)?.gaps, 0);
});
