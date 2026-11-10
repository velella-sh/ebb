import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { coverageBadge, lineCoverage } from "../tools/coverage-badge.js";

const run = promisify(execFile);

const report = (found: number, hit: number) => `TN:\nSF:a.js\nLF:${found}\nLH:${hit}\nend_of_record\n`;

test("line coverage sums every file in the report", () => {
  assert.equal(lineCoverage(`${report(10, 9)}${report(30, 30)}`), 97.5);
  assert.equal(lineCoverage(""), undefined);
});

test("the badge rounds down, so it never claims more than the suite covers", () => {
  assert.deepEqual(coverageBadge(report(1000, 999)), {
    schemaVersion: 1,
    label: "coverage",
    message: "99%",
    color: "3F6E66",
  });
  assert.equal(coverageBadge(report(100, 92)).color, "97CA00");
  assert.equal(coverageBadge(report(100, 80)).color, "DFB317");
  assert.equal(coverageBadge(report(100, 10)).color, "E05D44");
  assert.throws(() => coverageBadge("TN:\n"), /no instrumented lines/);
});

test("the command line writes the endpoint JSON and explains mistakes", async () => {
  const script = resolve("dist/tools/coverage-badge.js");
  const dir = await mkdtemp(join(tmpdir(), "ebb-badge-"));
  try {
    const input = join(dir, "lcov.info");
    const output = join(dir, "coverage.json");
    await writeFile(input, report(100, 96));
    const { stdout } = await run(process.execPath, [script, input, output]);
    assert.equal(stdout, "coverage: 96%\n");
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), {
      schemaVersion: 1,
      label: "coverage",
      message: "96%",
      color: "3F6E66",
    });
    await assert.rejects(run(process.execPath, [script]), /Usage: coverage-badge/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
