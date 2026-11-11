import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCountdownRows,
  countdownColor,
  formatCountdown,
  renderCountdown,
  renderCountdownJson,
  runCountdown,
} from "../src/countdown.js";
import { buildForecast } from "../src/forecast.js";
import type { RegistryV2Rule } from "../src/registry.js";

function sampleForecast() {
  const rules: RegistryV2Rule[] = [
    {
      id: "rule.soon",
      ecosystem: "npm",
      purl: "pkg:npm/soon",
      vers: "vers:npm/*",
      event: "end-of-life",
      title: "Soon package",
      summary: "Ends in 10 days",
      severity: "high",
      deadline: "2026-04-11",
      sources: [{ title: "s", url: "https://example.com/soon", accessedAt: "2026-01-01" }],
      provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
    },
    {
      id: "rule.soon.duplicate-title",
      ecosystem: "npm",
      purl: "pkg:npm/soon2",
      vers: "vers:npm/*",
      event: "end-of-life",
      title: "Soon package",
      summary: "Later duplicate title",
      severity: "medium",
      deadline: "2026-06-01",
      sources: [{ title: "s", url: "https://example.com/soon2", accessedAt: "2026-01-01" }],
      provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
    },
    {
      id: "rule.medium",
      ecosystem: "nodejs",
      purl: "pkg:generic/nodejs",
      vers: "vers:semver/*",
      event: "end-of-support",
      title: "Node.js 22",
      summary: "Medium window",
      severity: "medium",
      deadline: "2026-06-01",
      sources: [{ title: "s", url: "https://example.com/node", accessedAt: "2026-01-01" }],
      provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
    },
    {
      id: "rule.far",
      ecosystem: "python",
      purl: "pkg:generic/python",
      vers: "vers:pypi/*",
      event: "scheduled-end-of-life",
      title: "Python 3.12",
      summary: "Far window",
      severity: "low",
      deadline: "2027-04-01",
      sources: [{ title: "s", url: "https://example.com/py", accessedAt: "2026-01-01" }],
      provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
    },
  ];
  return buildForecast(
    {
      root: ".",
      findings: [
        {
          id: "1",
          ruleId: "rule.soon",
          detector: "npm",
          title: "Soon package",
          summary: "",
          severity: "high",
          location: { path: "package.json", line: 4 },
          sources: [],
        },
        {
          id: "1b",
          ruleId: "rule.soon.duplicate-title",
          detector: "npm",
          title: "Soon package",
          summary: "",
          severity: "medium",
          location: { path: "package.json", line: 5 },
          sources: [],
        },
        {
          id: "2",
          ruleId: "rule.medium",
          detector: "nodejs",
          title: "Node.js 22",
          summary: "",
          severity: "medium",
          location: { path: ".nvmrc" },
          sources: [],
        },
        {
          id: "3",
          ruleId: "rule.far",
          detector: "python",
          title: "Python 3.12",
          summary: "",
          severity: "low",
          location: { path: ".python-version" },
          sources: [],
        },
      ],
    },
    rules,
    "2026-04-01",
    24,
  );
}

test("countdown helpers classify colors, format remaining time, deduplicate rows, and render frames", () => {
  assert.equal(countdownColor(-1), "dim");
  assert.equal(countdownColor(10 * 86_400), "red");
  assert.equal(countdownColor(60 * 86_400), "yellow");
  assert.equal(countdownColor(200 * 86_400), "green");

  assert.equal(formatCountdown(-86_400), "ended 1 day ago");
  assert.equal(formatCountdown(-2 * 86_400), "ended 2 days ago");
  assert.equal(formatCountdown(90_061), "1d 01h 01m 01s");

  const forecast = sampleForecast();
  const now = Date.parse("2026-04-01T00:00:00Z");
  const rows = buildCountdownRows(forecast, { now, limit: 3 });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    subject: "Soon package",
    deadline: "2026-04-11",
    remainingSeconds: 10 * 86_400,
    ruleId: "rule.soon",
    location: { path: "package.json", line: 4 },
  });
  assert.equal(rows[1]!.location.line, undefined);

  assert.match(renderCountdown([]), /No dated lifecycle deadlines affect this repository\./);
  const plain = renderCountdown(rows, { asOf: "2026-04-01", barWidth: 10, color: false });
  assert.match(plain, /Lifecycle countdown as of 2026-04-01/);
  assert.match(plain, /10d 00h 00m 00s/);

  const colored = renderCountdown([...rows, { ...rows[0]!, remainingSeconds: -86_400 }], { color: true });
  assert.match(colored, /\u001b\[31m/);
  assert.match(colored, /\u001b\[2m/);

  const json = JSON.parse(renderCountdownJson(rows, now)) as { schemaVersion: string; rows: unknown[] };
  assert.equal(json.schemaVersion, "ebb.countdown.v1");
  assert.equal(json.rows.length, 3);
});

test("runCountdown prints once off-TTY, animates 6 frames on TTY, and exits 130 on SIGINT", async () => {
  const forecast = sampleForecast();
  const now = Date.parse("2026-04-01T00:00:00Z");
  const writes: string[] = [];

  const onceCode = await runCountdown({
    forecast,
    now,
    asOf: "2026-04-01",
    once: true,
    color: false,
    io: {
      isTTY: false,
      write: (text) => writes.push(text),
      setInterval: () => {
        throw new Error("should not schedule interval when once=true");
      },
      clearInterval: () => {},
      onInterrupt: () => () => {},
    },
  });
  assert.equal(onceCode, 0);
  assert.equal(writes.length, 1);

  let intervalCb: (() => void) | undefined;
  let cleared = 0;
  let disposed = 0;
  const ttyWrites: string[] = [];
  const animatedPromise = runCountdown({
    forecast,
    now,
    asOf: "2026-04-01",
    limit: 2,
    io: {
      isTTY: true,
      write: (text) => ttyWrites.push(text),
      setInterval: (cb) => {
        intervalCb = cb;
        return 42;
      },
      clearInterval: () => {
        cleared += 1;
      },
      onInterrupt: () => () => {
        disposed += 1;
      },
    },
  });
  for (let i = 0; i < 6; i++) intervalCb!();
  assert.equal(await animatedPromise, 0);
  assert.equal(ttyWrites.length, 7);
  assert.equal(cleared, 1);
  assert.equal(disposed, 1);

  let sigintHandler: (() => void) | undefined;
  const interruptedPromise = runCountdown({
    forecast,
    now,
    asOf: "2026-04-01",
    io: {
      isTTY: true,
      write: () => {},
      setInterval: () => 99,
      clearInterval: () => {},
      onInterrupt: (handler) => {
        sigintHandler = handler;
        return () => {};
      },
    },
  });
  sigintHandler!();
  assert.equal(await interruptedPromise, 130);
});
