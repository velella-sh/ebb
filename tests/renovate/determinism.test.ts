import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { RegistryV2Rule } from "../../src/registry.js";
import { writeRenovateFeeds } from "../../tools/static-api/renovate.js";

const TOTAL_RENOVATE_FEEDS_BUDGET_BYTES = 500_000; // 500 KB size budget for all feeds together

async function loadAllRegistryRules(): Promise<RegistryV2Rule[]> {
  const registryDir = join(process.cwd(), "registry");
  const entries = await readdir(registryDir);
  const rules: RegistryV2Rule[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json") || entry.includes("sha")) continue;
    const content = JSON.parse(await readFile(join(registryDir, entry), "utf8")) as {
      rules?: RegistryV2Rule[];
    };
    if (content.rules) rules.push(...content.rules);
  }
  return rules;
}

test("renovate feeds are deterministic and byte-for-byte identical across runs", async () => {
  const rules = await loadAllRegistryRules();
  const dirA = await mkdtemp(join(tmpdir(), "ebb-renovate-det-a-"));
  const dirB = await mkdtemp(join(tmpdir(), "ebb-renovate-det-b-"));

  try {
    const resA = await writeRenovateFeeds({
      outDir: dirA,
      rules,
      baseUrl: "https://velella.sh/ebb/api/v1",
      createdAt: "2026-11-27T00:00:00Z",
    });

    const resB = await writeRenovateFeeds({
      outDir: dirB,
      rules,
      baseUrl: "https://velella.sh/ebb/api/v1",
      createdAt: "2026-11-27T00:00:00Z",
    });

    assert.equal(resA.feeds.size, resB.feeds.size, "Both builds must generate identical feed counts");
    assert.ok(resA.feeds.size > 200, `Expected over 200 components with feeds, got ${resA.feeds.size}`);
    assert.equal(resA.totalRawBytes, resB.totalRawBytes, "Total raw bytes must match exactly");

    // Compare all feed files byte for byte
    for (const [purl, infoA] of resA.feeds) {
      const infoB = resB.feeds.get(purl);
      assert.ok(infoB, `Feed for ${purl} missing in second build`);

      const bytesA = await readFile(join(dirA, infoA.path));
      const bytesB = await readFile(join(dirB, infoB.path));
      assert.deepEqual(bytesA, bytesB, `Feed ${infoA.path} differs between runs`);

      // Scope check: no timestamps other than dataVersion (no runtime generatedAt/updatedAt)
      const text = bytesA.toString("utf8");
      assert.equal(text.includes('"generatedAt"'), false, "Feed must not include generatedAt timestamp");
      assert.equal(text.includes('"updatedAt"'), false, "Feed must not include updatedAt timestamp");
    }
  } finally {
    await rm(dirA, { recursive: true, force: true });
    await rm(dirB, { recursive: true, force: true });
  }
});

test("renovate feeds stay within total size budget", async () => {
  const rules = await loadAllRegistryRules();
  const tempDir = await mkdtemp(join(tmpdir(), "ebb-renovate-budget-"));

  try {
    const result = await writeRenovateFeeds({
      outDir: tempDir,
      rules,
      baseUrl: "https://velella.sh/ebb/api/v1",
      createdAt: "2026-11-27T00:00:00Z",
    });

    assert.ok(
      result.totalRawBytes < TOTAL_RENOVATE_FEEDS_BUDGET_BYTES,
      `Total Renovate feeds size (${result.totalRawBytes} bytes) exceeded budget (${TOTAL_RENOVATE_FEEDS_BUDGET_BYTES} bytes)`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
