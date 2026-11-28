import assert from "node:assert/strict";
import { test } from "node:test";
import { versContains } from "../../src/vers.js";
import { nodeEnginesVers, requiresPythonVers } from "../../tools/importers/compat-ranges.js";
import { measureFreshness } from "../../tools/importers/freshness.js";
import { execute } from "../../tools/importers/run.js";
import { runtimeSupportImporter } from "../../tools/importers/runtime-support.js";

test("recorded registry metadata groups releases while retaining gaps", async () => {
  const { table, notes } = await execute(runtimeSupportImporter(["pkg:npm/%40npmcli/move-file", "pkg:pypi/goobook"]), {
    replay: "tests/fixtures/compat/registry-recording.json",
  });
  const [npm, unions, , pypi, shared] = table.rows;
  assert.equal(table.rows.length, 5);
  assert.equal(npm?.subjectVers, "vers:npm/1.0.1|1.1.0|1.1.1|1.1.2");
  assert.equal(npm?.requires[0]?.vers, "vers:semver/>=10.0.0");
  assert.equal(unions?.requires[0]?.vers, "vers:semver/>=12.13.0|<13.0.0|>=14.15.0|<15.0.0|>=16.0.0");
  assert.equal(pypi?.subjectVers, "vers:pypi/3.5.2");
  assert.equal(pypi?.requires[0]?.vers, "vers:pypi/>=3.7|<4.0");
  assert.equal(shared?.subjectVers, "vers:pypi/3.5.3|3.5.4");
  assert.equal(shared?.requires[0]?.vers, "vers:pypi/>=3.9|<4.0");
  assert.ok(table.rows.every(({ kind, source }) => kind === "declared" && source.accessedAt === "2026-11-28"));
  assert.ok(notes.every((note) => note.includes("no runtime range was declared")));
  const freshness = measureFreshness([], { maxAgeDays: { "runtime-support": 30 } }, "2026-12-29", table.rows);
  assert.equal(freshness.sources[0]?.status, "missed");
  assert.equal(freshness.sources[0]?.lastReviewedAt, "2026-11-28");
});

test("native range normalization preserves disjoint arms, wildcard exclusions and compatible releases", () => {
  assert.equal(nodeEnginesVers("^20.19.0 || >=22.12.0 || >=24.0.0"), "vers:semver/>=20.19.0|<21.0.0|>=22.12.0");
  const python = requiresPythonVers("~=3.10,!=3.11.*,!=3.12.2");
  for (const version of ["3.10", "3.12.1", "3.13"]) assert.equal(versContains(python, version), true, version);
  for (const version of ["3.9", "3.11.8", "3.12.2", "4.0"]) assert.equal(versContains(python, version), false, version);
  assert.throws(() => requiresPythonVers("===any"));
  assert.throws(() => nodeEnginesVers("not a range"));
});
