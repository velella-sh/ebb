import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readReleaseBaseline, readWorkingSchemas } from "../../tools/schema-evolution/baseline.js";
import { compareCatalogs } from "../../tools/schema-evolution/diff.js";
import { repository } from "./repository.js";

const cli = fileURLToPath(new URL("../../tools/schema-evolution/check.js", import.meta.url));
const schema = "schemas/rule.schema.json";

test("chooses the latest stable reachable tag and reads its committed schemas", (t) => {
  const repo = repository(t);
  repo.write(schema, { type: "object" });
  repo.tag("1.0.0");
  repo.write("schemas/vendor/vendored.schema.json", false);
  repo.write("schemas/deprecations.json", { entries: [] });
  repo.write("schemas/lifecycle/1.0/example.schema.json", { type: "string" });
  const commit = repo.tag("1.1.0");
  repo.tag("1.2.0-rc.1");
  repo.git("switch", "-qc", "other-release");
  repo.tag("2.0.0");
  repo.git("switch", "-q", "main");

  const baseline = readReleaseBaseline(repo.path);
  assert.equal(baseline.tag, "v1.1.0");
  assert.equal(baseline.commit, commit);
  assert.deepEqual([...baseline.schemas.keys()], ["schemas/lifecycle/1.0/example.schema.json", schema]);

  rmSync(join(repo.path, schema));
  repo.write("schemas/new.schema.json", true);
  assert.deepEqual(
    compareCatalogs(baseline.schemas, readWorkingSchemas(repo.path)).map((change) => [change.file, change.class]),
    [
      ["schemas/new.schema.json", "additive"],
      [schema, "breaking"],
    ],
  );
});

test("fails clearly in a shallow clone or without a reachable package release", (t) => {
  const noRelease = repository(t);
  noRelease.write(schema, {});
  noRelease.git("add", ".");
  noRelease.git("commit", "-qm", "draft");
  assert.throws(() => readReleaseBaseline(noRelease.path), /No stable package release tag reachable/u);
  const shallow = repository(t);
  shallow.git("clone", "--depth", "1", `file://${noRelease.path}`, "clone");
  assert.throws(() => readReleaseBaseline(join(shallow.path, "clone")), /full Git history and release tags/u);
});

test("CLI reports strict exit status against a tagged temporary repository", (t) => {
  const repo = repository(t);
  repo.write(schema, { type: "object", additionalProperties: false, properties: { note: { type: "string" } } });
  const commit = repo.tag("1.0.0");
  const run = () => spawnSync(process.execPath, [cli], { cwd: repo.path, encoding: "utf8" });
  const unchanged = run();
  assert.equal(unchanged.status, 0);
  assert.ok(unchanged.stdout.includes(commit));
  repo.write(schema, { type: "object", additionalProperties: false, properties: {} });
  const breaking = run();
  assert.equal(breaking.status, 1);
  assert.match(breaking.stdout, /\[breaking\].*#\/properties\/note/u);
  repo.write(schema, { type: "object", allOf: [{ type: "object" }] });
  const unknown = run();
  assert.equal(unknown.status, 1);
  assert.match(unknown.stdout, /\[unknown\].*#\/allOf/u);
  rmSync(join(repo.path, "schemas"), { recursive: true });
  const removed = run();
  assert.equal(removed.status, 1);
  assert.match(removed.stdout, /Released schema file removed/u);
});
