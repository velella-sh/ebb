import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { validateRegistryV2 } from "../src/registry.js";
import { versContains } from "../src/vers/index.js";

// Compiled to dist/tests/, two levels below the package root.
const packageRoot = join(import.meta.dirname, "..", "..");

async function rules() {
  return validateRegistryV2(JSON.parse(await readFile(join(packageRoot, "registry/rust.json"), "utf8"))).rules;
}

test("every Rust rule cites an authoritative source", async () => {
  const all = await rules();
  for (const rule of all) {
    assert.ok(
      rule.sources.every((source) => source.url.startsWith("https://")),
      rule.id,
    );
    assert.ok(
      rule.sources.some((source) =>
        /^https:\/\/(?:rustsec\.org\/advisories\/RUSTSEC-\d{4}-\d{4}\.html|www\.rust-lang\.org\/policies\/security)$/.test(
          source.url,
        ),
      ),
      `${rule.id} cites RustSec or the Rust policy`,
    );
  }
});

test("Rust toolchains retain the support deadline for their release line", async () => {
  const toolchains = (await rules()).filter((rule) => rule.purl === "pkg:generic/rust");
  assert.ok(toolchains.every((rule) => rule.event === "end-of-support"));
  for (const [version, deadlines] of [
    ["1.0.0", ["2026-10-01"]],
    ["1.70.0", ["2026-10-01"]],
    ["1.98.1", ["2026-10-01"]],
    ["1.99.0", ["2026-11-12"]],
    ["1.99.1", ["2026-11-12"]],
    ["1.100.0", []],
  ] as const) {
    const matching = toolchains.filter((rule) => versContains(rule.vers, version));
    assert.deepEqual(
      matching.map((rule) => rule.deadline),
      deadlines,
      version,
    );
  }
  const registry = JSON.parse(await readFile(join(packageRoot, "registry/rust.json"), "utf8")) as {
    freshness: { maxReviewAgeDays: number };
  };
  assert.equal(registry.freshness.maxReviewAgeDays, 45, "a moving rule needs a short review window");
});

test("the crate rules match any version of the crate and no other crate", async () => {
  const crates = (await rules()).filter((rule) => rule.purl.startsWith("pkg:cargo/"));
  assert.deepEqual(crates.map((rule) => rule.purl).sort(), [
    "pkg:cargo/ansi_term",
    "pkg:cargo/atty",
    "pkg:cargo/failure",
    "pkg:cargo/tempdir",
  ]);
  for (const rule of crates) {
    assert.equal(rule.event, "deprecated");
    assert.ok(versContains(rule.vers, "0.0.1") && versContains(rule.vers, "99.0.0"), rule.id);
  }
});
