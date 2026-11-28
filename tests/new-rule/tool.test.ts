import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { validateRegistryV2 } from "../../src/registry.js";
import { checkCases, readCases, registryRules } from "../../tools/rule-cases.js";

const executable = resolve("dist/tools/new-rule.js");

test("the standalone tool confirms and writes a rule, its ecosystem module and passing cases", async () => {
  const root = await mkdtemp(join(tmpdir(), "ebb-new-rule-test-"));
  try {
    await mkdir(join(root, "registry"));
    const path = join(root, "registry/npm.json");
    const original = validateRegistryV2(await readFile("registry/npm.json", "utf8"));
    await writeFile(path, JSON.stringify(original));
    const inputs = [
      "pkg:npm/test-quick-add",
      "",
      "vers:npm/<2.0.0",
      "end-of-life",
      "2025-05-01",
      "https://developer.mozilla.org/en-US/",
      "Test fixture",
      "2026-01-01",
      "npm.package.test-quick-add.eol",
      "Test fixture version 1 reached end of life",
      "Test fixture version 1 reached end of life on 2025-05-01.",
      "",
      "ebb-example",
      "1.0.0",
      "2.0.0",
    ];
    const input = (confirmation: string) => [...inputs, confirmation, ""].join("\n");
    const before = await readFile(path, "utf8");
    const cancel = execFileSync(process.execPath, [executable], { cwd: root, input: input("no"), encoding: "utf8" });
    assert.match(cancel, /No files written/);
    assert.equal(await readFile(path, "utf8"), before);
    const wrong = spawnSync(process.execPath, [executable], {
      cwd: root,
      input: input("yes").replace("\n1.0.0\n2.0.0", "\n1.0.0\n1.1.0"),
      encoding: "utf8",
    });
    assert.equal(wrong.status, 1);
    assert.match(wrong.stderr, /inside the range and one outside/);
    assert.equal(await readFile(path, "utf8"), before);
    const success = execFileSync(process.execPath, [executable], {
      cwd: root,
      input: input("yes"),
      encoding: "utf8",
    });
    assert.match(success, /gh pr create/);
    const id = "npm.package.test-quick-add.eol";
    const rules = await registryRules(root);
    assert.equal(rules.length, original.rules.length + 1);
    assert.equal(rules.at(-1)?.id, id);
    const cases = (await readCases(root)).get("cases/npm.json");
    assert.deepEqual(cases, [
      { purl: "pkg:npm/test-quick-add", version: "1.0.0", rules: [id] },
      { purl: "pkg:npm/test-quick-add", version: "2.0.0", rules: [] },
    ]);
    assert.deepEqual(await checkCases(root), { checked: 2, failures: [] });
    assert.match(await readFile(join(root, "src/data/ecosystems/npm.ts"), "utf8"), /npm\.package\.test-quick-add\.eol/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
