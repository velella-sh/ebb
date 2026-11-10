import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { main } from "../../tools/importers/run.js";

const run = promisify(execFile);
const script = resolve("dist/tools/importers/run.js");

const recording = resolve("tests/importers/recordings/ci-images-1.json");

test("--list prints every registered importer", async () => {
  const { stdout } = await run(process.execPath, [script, "--list"]);
  assert.match(stdout, /^ci-images-1\tci-images\t/m);
});

test("replaying an importer prints its drafts, or writes them with --out", async () => {
  const printed = await run(process.execPath, [script, "ci-images-1", "--replay", recording]);
  assert.equal(JSON.parse(printed.stdout).importer, "ci-images-1");

  const dir = await mkdtemp(join(tmpdir(), "ebb-run-"));
  try {
    const out = join(dir, "drafts.json");
    const written = await run(process.execPath, [script, "ci-images-1", "--replay", recording, "--out", out]);
    assert.equal(written.stdout, "");
    assert.equal(JSON.parse(await readFile(out, "utf8")).importer, "ci-images-1");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects missing values, a second importer id, and an empty command line", async () => {
  await assert.rejects(main(["--out"]), /--out needs a value/);
  await assert.rejects(main(["a", "b"]), /Unexpected argument "b"/);
  await assert.rejects(main([]), /Usage: run <importer-id>/);
});
