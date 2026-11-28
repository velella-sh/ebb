import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCli } from "../../src/cli.js";

test("sbom enrich writes JSON or a separate output file, and invalid input fails", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "ebb-sbom-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, "sbom.json");
  const output = join(root, "enriched.json");
  const source = JSON.stringify({
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    components: [{ name: "node-sass", purl: "pkg:npm/node-sass@9.0.0" }],
  });
  writeFileSync(file, source);
  let stdout = "";
  let stderr = "";
  const io = {
    stdout: {
      write: (data: string) => {
        stdout += data;
      },
    },
    stderr: {
      write: (data: string) => {
        stderr += data;
      },
    },
  };

  assert.equal(await runCli(["sbom", "enrich", file, "--format", "cyclonedx"], io), 0);
  const enriched = JSON.parse(stdout);
  assert.equal(enriched.components[0].properties[0].value, "2024-07-24");
  const summary = { checked: 1, enriched: 1, notIdentified: [] };
  assert.deepEqual(JSON.parse(stderr), summary);

  stdout = "";
  stderr = "";
  assert.equal(await runCli(["sbom", "enrich", "--out", output, "--", file], io), 0);
  assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), enriched);
  assert.deepEqual(JSON.parse(stdout), summary);
  assert.equal(stderr, "");
  assert.equal(await runCli(["sbom", "enrich", file, "--out", file], io), 2);
  assert.equal(readFileSync(file, "utf8"), source);
  assert.equal(await runCli(["sbom", "enrich", file, "--format", "spdx"], io), 2);
  assert.equal(await runCli(["sbom", "enrich", file, "--format", "markdown"], io), 2);
});
