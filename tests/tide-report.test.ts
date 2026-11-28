import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parse } from "yaml";

import { appendReleaseLog, verifyReleaseLog } from "../src/data-release-log.js";
import type { RegistryV2Rule } from "../src/registry.js";
import { renderTideCard, renderTideReport } from "../tools/tide-report.js";

function log(...days: string[]) {
  return verifyReleaseLog(
    days.reduce(
      (text, day) =>
        appendReleaseLog(text, {
          version: day.replaceAll("-", "."),
          createdAt: day + "T07:00:00Z",
          contentDigest: `sha256:${"a".repeat(64)}`,
          bundleSha256: `sha256:${"b".repeat(64)}`,
        }),
      "",
    ),
  );
}

function rule(id: string, deadline: string, overrides: Partial<RegistryV2Rule> = {}): RegistryV2Rule {
  return {
    id,
    deadline,
    ecosystem: "npm",
    purl: `pkg:npm/${id}`,
    vers: "vers:npm/*",
    event: "scheduled-end-of-life",
    title: id,
    summary: "Recorded end date.",
    severity: "low",
    sources: [{ title: "Vendor calendar", url: `https://example.com/releases/${id}`, accessedAt: "2028-01-20" }],
    provenance: { observedAt: "2028-01-20", reviewedAt: "2028-01-20", reviewer: "fixture", method: "manual" },
    ...overrides,
  };
}

const current = [
  rule("february", "2028-02-29", { title: "February [month only]", "x-test": { endOfLifeMonth: "2028-02" } }),
  rule("changed", "2028-03-01"),
  rule("last-day", "2028-05-01"),
  rule("past-window", "2028-05-02"),
  rule("estimated", "2028-02-03", { "x-estimated": {}, confidence: "tentative", confidenceNote: "Fixture estimate." }),
  rule("last-month", "2028-01-31", { event: "end-of-life" }),
  rule("later-observation", "2028-02-07", {
    provenance: { observedAt: "2028-02-02", reviewedAt: "2028-02-02", reviewer: "fixture", method: "manual" },
  }),
];
const example = {
  month: "2028-02",
  rules: current,
  ruleSlugs: new Map(current.map(({ id }) => [id, id])),
  releaseLog: log("2027-12-15", "2028-01-27"),
  baselineRules: [rule("changed", "2028-03-02")],
};

test("one month, 90-day UTC boundaries and prior events stay separate from estimates and signed changes", () => {
  const report = renderTideReport(example);
  const body = report.markdown;
  assert.match(body, /^<!-- ebb-tide-report:2028-02 -->\n# Tide report — February 2028/u);
  assert.match(body, /As of 2028-02-01 UTC/u);
  const [, month = "", next = "", predicted = "", previous = ""] = body.split(/^## /mu);
  assert.match(
    month,
    /- 2028-02 — \[February \\\[month only\\\]\]\(<https:\/\/velella\.sh\/ebb\/rules\/february\/>\)/u,
  );
  assert.match(month, /\[Vendor calendar\]\(<https:\/\/example\.com\/releases\/february>\)/u);
  assert.doesNotMatch(month + next, /\/rules\/estimated\//u);
  assert.match(next, /through 2028-05-01 UTC/u);
  assert.match(next, /- 2028-05-01 —/u);
  assert.doesNotMatch(next, /past-window|\/rules\/february\//u);
  assert.match(predicted, /2028-02-03 \(estimate, rule confidence tentative\)/u);
  assert.match(previous, /Signed comparison 2027\.12\.15 → 2028\.01\.27/u);
  assert.match(previous, /- Added — \[February/u);
  assert.match(previous, /- Changed — \[changed/u);
  assert.match(previous, /- 2028-01-31 — \[last-month/u);
  assert.doesNotMatch(body, /later-observation/u);
  assert.deepEqual(renderTideReport({ ...example, rules: [...current].reverse() }), report);
  assert.deepEqual(report.card, {
    title: "Tide report — February 2028",
    description: "2028-02 February [month only] · 2028-03-01 changed · 2028-05-01 last-day",
  });
});

test("empty periods explain absent deadlines, estimates and comparisons", () => {
  const input = { month: "2028-02", rules: [], ruleSlugs: new Map(), releaseLog: log("2028-01-01") };
  const report = renderTideReport(input);
  assert.match(report.markdown, /No announced deadlines this month/u);
  assert.match(report.markdown, /No additional announced deadlines in this window/u);
  assert.match(report.markdown, /no estimated deadlines/u);
  assert.match(report.markdown, /no earlier baseline/u);
  assert.match(report.markdown, /No announced deadlines recorded in this window/u);
  assert.equal(report.card.description, "No announced deadlines in this window.");
  assert.throws(() => renderTideReport({ ...input, month: "2028-00" }), /YYYY-MM/u);
  assert.throws(() => renderTideReport({ ...input, month: "2027-12" }), /dated on or before/u);
});

const tools = process.env.EBB_SITE_TOOLS;
test("the pinned native renderer produces the same 1200×630 card on two dry renders", { skip: !tools }, async (t) => {
  assert.ok(tools);
  const temporary = await mkdtemp(join(tmpdir(), "ebb-tide-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const report = renderTideReport(example);
  const one = join(temporary, "one.png");
  const two = join(temporary, "two.png");
  await renderTideCard(report, tools, one);
  await renderTideCard(report, tools, two);
  const png = await readFile(one);
  assert.deepEqual(png, await readFile(two));
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test("preview period is stable on rerun and selects only the first scheduled Monday", {
  skip: process.platform === "win32",
}, async (t) => {
  const workflow = parse(await readFile(".github/workflows/tide-report.yml", "utf8"));
  assert.deepEqual(workflow.on.schedule, [{ cron: "17 7 * * 1" }]);
  assert.deepEqual(workflow.permissions, {});
  assert.deepEqual(workflow.jobs.preview.permissions, { contents: "read" });
  const upload = workflow.jobs.preview.steps.find(({ uses }: { uses?: string }) =>
    uses?.startsWith("actions/upload-artifact@"),
  );
  assert.equal(upload.with.overwrite, true);

  const temporary = await mkdtemp(join(tmpdir(), "ebb-tide-period-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const output = join(temporary, "output");
  const script = `date() { case "$2" in +%d) printf '%s\\n' "$DAY";; +%Y-%m) echo 2028-02;; esac; }\n${workflow.jobs.period.steps[0].run}`;
  async function run(day: string, event: string, requested = "") {
    await writeFile(output, "");
    const result = spawnSync("bash", ["-e", "-c", script], {
      encoding: "utf8",
      env: {
        GITHUB_EVENT_NAME: event,
        GITHUB_OUTPUT: output,
        REQUESTED_MONTH: requested,
        DAY: day,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    return readFile(output, "utf8");
  }
  assert.equal(await run("07", "schedule"), "enabled=true\nmonth=2028-02\n");
  assert.equal(await run("07", "schedule"), "enabled=true\nmonth=2028-02\n");
  assert.equal(await run("14", "schedule"), "enabled=false\n");
  assert.equal(await run("14", "workflow_dispatch", "2028-03"), "enabled=true\nmonth=2028-03\n");
});
