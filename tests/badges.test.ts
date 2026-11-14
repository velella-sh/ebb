import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { generateDataBadges } from "../tools/badges.js";

test("generateDataBadges writes rules and stale-rules endpoint JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ebb-badges-"));
  try {
    const { totalRules, staleRules, fileCount } = await generateDataBadges("registry", dir, "2026-11-14");
    assert.ok(fileCount > 0);
    assert.ok(totalRules > 0);
    assert.equal(staleRules, 0);

    const rules = JSON.parse(await readFile(join(dir, "rules.json"), "utf8"));
    assert.equal(rules.label, "rules");
    assert.equal(rules.message, String(totalRules));

    const staleBadge = JSON.parse(await readFile(join(dir, "stale-rules.json"), "utf8"));
    assert.equal(staleBadge.label, "stale rules");
    assert.equal(staleBadge.message, "0");
    assert.equal(staleBadge.color, "3F6E66");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
