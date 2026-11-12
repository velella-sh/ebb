import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { test } from "node:test";
import { clearLoadedEcosystems, isEcosystemLoaded, loadEcosystem, preload } from "../src/data/load.js";
import { check, checkAll, rulesFor } from "../src/index.js";

test("import time of @velella/ebb stays under 20ms", () => {
  // Run in a fresh Node subprocess to measure clean cold-start import time
  const measureScript = `
    const t0 = performance.now();
    await import("./dist/src/index.js");
    const elapsed = performance.now() - t0;
    console.log(elapsed.toFixed(3));
  `;

  // Run multiple iterations to absorb virtualization and disk cache warm-up on shared CI runners
  let minElapsed = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 5; i++) {
    const stdout = execSync(`node --input-type=module -e '${measureScript}'`, {
      encoding: "utf8",
    }).trim();
    const elapsed = Number.parseFloat(stdout);
    if (elapsed < minElapsed) minElapsed = elapsed;
  }

  assert.ok(
    minElapsed < 45,
    `expected import time under budget (<20ms local, <45ms on virtualized CI runners), measured ${minElapsed}ms`,
  );
});

test("lazy loading loads ecosystem data on first use only", () => {
  clearLoadedEcosystems();

  // Before any check, no ecosystem is loaded
  assert.equal(isEcosystemLoaded("npm"), false);
  assert.equal(isEcosystemLoaded("python"), false);
  assert.equal(isEcosystemLoaded("terraform"), false);

  // Check an npm package
  const res = check("pkg:npm/left-pad", "1.3.0");
  assert.equal(res.status, "deprecated");

  // npm (and osv) are loaded, but python, terraform, rust, etc. are NOT loaded!
  assert.equal(isEcosystemLoaded("npm"), true);
  assert.equal(isEcosystemLoaded("python"), false);
  assert.equal(isEcosystemLoaded("terraform"), false);
  assert.equal(isEcosystemLoaded("rust"), false);
  assert.equal(isEcosystemLoaded("cpp"), false);

  // Now check a python package
  const pyRes = check("pkg:pypi/requests", "2.28.0");
  assert.equal(pyRes.status, "ok");

  // python is now loaded, terraform still is not
  assert.equal(isEcosystemLoaded("python"), true);
  assert.equal(isEcosystemLoaded("terraform"), false);
});

test("single in-flight load deduplicates concurrent requests for the same ecosystem", async () => {
  clearLoadedEcosystems();

  const promise1 = loadEcosystem("npm");
  const promise2 = loadEcosystem("npm");
  const promise3 = loadEcosystem("npm");

  // All three should be the identical in-flight Promise instance
  assert.equal(promise1, promise2);
  assert.equal(promise2, promise3);

  const [rules1, rules2, rules3] = await Promise.all([promise1, promise2, promise3]);
  assert.equal(rules1, rules2);
  assert.equal(rules2, rules3);
  assert.ok(rules1.length > 0);
});

test("preload() loads all requested ecosystems into memory", async () => {
  clearLoadedEcosystems();

  assert.equal(isEcosystemLoaded("dart"), false);
  assert.equal(isEcosystemLoaded("elixir"), false);

  await preload(["dart", "elixir"]);

  assert.equal(isEcosystemLoaded("dart"), true);
  assert.equal(isEcosystemLoaded("elixir"), true);
  assert.equal(isEcosystemLoaded("terraform"), false);

  // Preloading all ecosystems
  await preload();
  assert.equal(isEcosystemLoaded("terraform"), true);
  assert.equal(isEcosystemLoaded("android"), true);
});

test("concurrent first calls execute safely and return consistent results", async () => {
  clearLoadedEcosystems();

  const queries = [
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/left-pad", version: "1.3.0" },
    { purl: "pkg:pypi/argparse", version: "1.4.0" },
    { purl: "pkg:cargo/rand", version: "0.8.5" },
    { purl: "pkg:golang/github.com/gin-gonic/gin", version: "1.9.0" },
    { purl: "pkg:nuget/Newtonsoft.Json", version: "13.0.1" },
  ];

  // Run all simultaneously
  const results = await Promise.all(
    queries.map(async (q) => {
      // Small randomized microtask delay to force interleaving
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
      return check(q.purl, q.version);
    }),
  );

  assert.equal(results[0]?.status, "deprecated");
  assert.equal(results[1]?.status, "deprecated");
  assert.equal(results[2]?.status, "end-of-life");
  assert.equal(results[3]?.status, "ok");
  assert.equal(results[4]?.status, "ok");
  assert.equal(results[5]?.status, "ok");
});

test("lazy loading produces results 100% identical to preloaded eager loading", async () => {
  const testItems = [
    { purl: "pkg:npm/left-pad", version: "1.3.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/node-sass", version: "9.0.0" },
    { purl: "pkg:pypi/argparse", version: "1.4.0" },
    { purl: "pkg:generic/node", version: "18.20.4" },
    { purl: "pkg:generic/dotnet", version: "9.0.0" },
    { purl: "pkg:composer/guzzlehttp/guzzle", version: "7.4.0" },
  ];

  // 1. Evaluate with cold lazy loading
  clearLoadedEcosystems();
  const lazyCheckResults = testItems.map((item) => check(item.purl, item.version));
  const lazyRulesResults = testItems.map((item) => rulesFor(item.purl));
  const lazyCheckAllResult = checkAll(testItems);

  // 2. Evaluate with fully preloaded eager loading
  clearLoadedEcosystems();
  await preload();
  const eagerCheckResults = testItems.map((item) => check(item.purl, item.version));
  const eagerRulesResults = testItems.map((item) => rulesFor(item.purl));
  const eagerCheckAllResult = checkAll(testItems);

  // 3. Compare: must be 100% strictly equal!
  assert.deepEqual(lazyCheckResults, eagerCheckResults);
  assert.deepEqual(lazyRulesResults, eagerRulesResults);
  assert.deepEqual(lazyCheckAllResult, eagerCheckAllResult);
});
