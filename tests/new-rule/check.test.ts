import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import type { RegistryV2Rule } from "../../src/registry.js";
import { inspectSources } from "../../tools/new-rule-check.js";

const dated: RegistryV2Rule = {
  id: "nodejs.runtime.example",
  ecosystem: "nodejs",
  purl: "pkg:generic/nodejs",
  vers: "vers:semver/>=20.0.0|<21.0.0",
  event: "end-of-life",
  title: "Recorded Node.js evidence",
  summary: "Fixture",
  severity: "low",
  deadline: "2026-04-30",
  sources: [{ title: "Schedule", url: "https://nodejs.org/about", accessedAt: "2026-10-01" }],
  provenance: { observedAt: "2026-10-01", reviewedAt: "2026-10-01", reviewer: "ebb-example", method: "manual" },
};

test("source checks report the claimed date, missing date, archive request outcome, and unreachability", async () => {
  const url = "https://nodejs.org/about";
  const requested: string[] = [];
  const archive = async (value: string) => {
    requested.push(value);
    return "requested (HTTP 302)";
  };
  assert.deepEqual(await inspectSources(dated, async () => "<div>April 30, 2026</div>", archive), [
    [url, "reachable", "found 2026-04-30", "requested (HTTP 302)"],
  ]);
  assert.deepEqual(requested, [url]);
  assert.deepEqual(
    await inspectSources(
      dated,
      async () => "another date",
      () => Promise.reject(new Error()),
    ),
    [[url, "reachable", "could not find 2026-04-30", "request failed"]],
  );
  assert.deepEqual(await inspectSources(dated, () => Promise.reject(new Error()), archive), [
    [url, "unreachable", "unverified", "skipped (unreachable)"],
  ]);
  assert.deepEqual(requested, [url]);
});

test("the report checks only data blobs from an untrusted suggestion", async () => {
  const root = await mkdtemp(join(tmpdir(), "ebb-rule-review-test-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    git("init", "--quiet");
    git("config", "user.name", "Ebb fixture");
    git("config", "user.email", "ebb-fixture@example.com");
    await mkdir(join(root, "schemas"));
    await copyFile("schemas/rule.v2.schema.json", join(root, "schemas/rule.v2.schema.json"));
    git("add", "schemas");
    git("commit", "--quiet", "-m", "fixture base");
    const base = git("rev-parse", "HEAD");

    await mkdir(join(root, "registry"));
    await mkdir(join(root, "cases"));
    await writeFile(
      join(root, "registry/nodejs.json"),
      JSON.stringify({
        schemaVersion: "ebb.registry.v2",
        ecosystem: "nodejs",
        rules: [
          { ...dated, sources: [{ title: "Test vendor", url: "https://test.invalid/", accessedAt: "2026-10-01" }] },
        ],
      }),
    );
    await writeFile(
      join(root, "cases/nodejs.json"),
      JSON.stringify({
        cases: [
          { purl: dated.purl, version: "20.1.0", rules: [dated.id] },
          { purl: dated.purl, version: "22.1.0", rules: [] },
        ],
      }),
    );
    await writeFile(join(root, "package.json"), '{"scripts":{"postinstall":"exit 99"}}');
    git("add", "registry", "cases", "package.json");
    git("commit", "--quiet", "-m", "test suggestion");
    const head = git("rev-parse", "HEAD");
    git("checkout", "--quiet", "--detach", base);

    execFileSync(process.execPath, [resolve("dist/tools/new-rule-check.js"), base, head, "report.md"], { cwd: root });
    const report = await readFile(join(root, "report.md"), "utf8");
    assert.match(report, /2 behavior cases passed/);
    assert.match(report, /schema passed, lint passed, match present, non-match present/);
    assert.match(report, /unreachable/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
