import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { main } from "../tools/check-sources.js";

async function withFixture(run: (dir: string, base: string) => Promise<void>) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("<html><head><title>Docs</title></head></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })) as typeof fetch;
  const base = "https://example.com";
  const dir = await mkdtemp(join(tmpdir(), "ebb-main-"));
  try {
    await writeFile(
      join(dir, "npm.json"),
      JSON.stringify({
        schemaVersion: "ebb.registry.v2",
        ecosystem: "npm",
        freshness: { maxReviewAgeDays: 30 },
        rules: [
          {
            id: "npm.package.sample.deprecated",
            ecosystem: "npm",
            purl: "pkg:npm/sample",
            vers: "vers:npm/*",
            event: "deprecated",
            title: "T",
            summary: "S",
            severity: "high",
            sources: [{ title: "Source", url: `${base}/page`, accessedAt: "2024-01-01" }],
            provenance: { observedAt: "2024-01-01", reviewedAt: "2024-01-02", reviewer: "maintainer" },
          },
        ],
      }),
    );
    await run(dir, base);
  } finally {
    globalThis.fetch = realFetch;
    await rm(dir, { recursive: true, force: true });
  }
}

test("main writes the report, summary and lock, and exits 1 for a failing category", async () => {
  await withFixture(async (dir) => {
    const out = join(dir, "report.json");
    const summary = join(dir, "summary.md");
    const lock = join(dir, "sources.lock.json");
    const stderr: string[] = [];
    const realErr = process.stderr.write.bind(process.stderr);
    const realOut = process.stdout.write.bind(process.stdout);
    process.stderr.write = ((chunk: string) => (stderr.push(String(chunk)), true)) as typeof process.stderr.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;
    let code: number;
    try {
      code = await main([
        "--registry-dir",
        dir,
        "--lock",
        lock,
        "--out",
        out,
        "--summary",
        summary,
        "--update-lock",
        "--fail-on",
        "stale",
        "--now",
        "2026-10-15T12:00:00Z",
        "--timeout",
        "2000",
        "--concurrency",
        "1",
      ]);
    } finally {
      process.stderr.write = realErr;
      process.stdout.write = realOut;
    }
    assert.equal(code, 1);
    assert.match(stderr.join(""), /Needs review: stale/);
    assert.equal(JSON.parse(await readFile(out, "utf8")).stale.length, 1);
    assert.match(await readFile(summary, "utf8"), /Source freshness/);
    assert.equal(Object.keys(JSON.parse(await readFile(lock, "utf8")).sources).length, 1);
  });
});

test("main prints the summary to stdout and exits 0 when nothing fails", async () => {
  await withFixture(async (dir) => {
    const chunks: string[] = [];
    const realOut = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => (chunks.push(String(chunk)), true)) as typeof process.stdout.write;
    let code: number;
    try {
      code = await main(["--registry-dir", dir, "--lock", join(dir, "none.json"), "--now", "2026-10-15T12:00:00Z"]);
    } finally {
      process.stdout.write = realOut;
    }
    assert.equal(code, 0);
    assert.match(chunks.join(""), /Source freshness/);
  });
});

test("main rejects a lock file with an unsupported schema", async () => {
  await withFixture(async (dir) => {
    const lock = join(dir, "bad.lock.json");
    await writeFile(lock, JSON.stringify({ schemaVersion: "other", sources: {} }));
    await assert.rejects(main(["--registry-dir", dir, "--lock", lock]), /Unsupported source lock: other/);
  });
});
