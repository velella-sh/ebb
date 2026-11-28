import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { firstSupporting, requirementsOf, supports } from "../../src/compat.js";

const django = "pkg:pypi/django";
const python = "pkg:generic/python";
const node = "pkg:generic/nodejs";

test("offline queries retain both rows and prefer documented runtime ranges", () => {
  const declared = requirementsOf(django, "5.1.2").find(({ kind }) => kind === "declared");
  assert.ok(declared);
  assert.match(declared.source.url, /^https:\/\/pypi\.org\//);
  const unsupported = supports(django, "5.1.2", python, "3.13");
  assert.equal(unsupported.status, "not-supported");
  assert.ok("row" in unsupported && unsupported.row.kind === "documented");
  assert.equal(supports(django, "5.1.3", python, "3.13").status, "supported");
  assert.deepEqual(supports(django, "999", python, "3.13"), { status: "unknown" });
  assert.deepEqual(supports(django, "5.1.3", node, "22"), { status: "unknown" });
  const first = firstSupporting(django, python, "3.13");
  assert.ok(first.status === "supported" && first.row.kind === "documented");
  assert.equal(first.version, "5.1.3");
});

test("declared evidence answers when no documented row applies", () => {
  const declared = supports("pkg:npm/next", "12.0.0", node, "16.20.0");
  assert.equal(declared.status, "supported");
  assert.ok("row" in declared && declared.row.kind === "declared");
  assert.deepEqual(supports("pkg:npm/next", "12.0.0", node, "16.20.0-rc.1"), { status: "unknown" });
});

test("compat imports without reading bundled files", () => {
  const entry = new URL("../../src/compat.js", import.meta.url).href;
  execFileSync(process.execPath, [
    "--input-type=module",
    "--eval",
    `
    import assert from "node:assert/strict";
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    fs.readdirSync = () => { throw new Error("table was read"); };
    syncBuiltinESMExports();
    const { requirementsOf } = await import(${JSON.stringify(entry)});
    assert.throws(() => requirementsOf("pkg:pypi/django", "5.1.3"), /table was read/);
  `,
  ]);
});
