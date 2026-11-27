import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const repoRoot = resolve(process.cwd());
const syftFixturePath = resolve(repoRoot, "tests/fixtures/syft/syft-v1.json");
const scriptPath = resolve(repoRoot, "examples/xeol/check-syft.ts");

describe("xeol-compat-7: Add a CI example", () => {
  it("executes examples/xeol/check-syft.ts script directly via node and parses xeol output", () => {
    const stdout = execFileSync(process.execPath, ["--experimental-strip-types", scriptPath, syftFixturePath], {
      encoding: "utf-8",
      cwd: repoRoot,
    });

    assert.ok(stdout.includes("Evaluating Syft SBOM at:"));
    assert.ok(stdout.includes("Artifacts total: 5"));
    assert.ok(stdout.includes("Evaluated components: 4"));
    assert.ok(stdout.includes("Skipped without purl: 1"));

    // Verify it printed xeol JSON
    const jsonStart = stdout.indexOf('{\n  "matches":');
    assert.ok(jsonStart !== -1, "Expected xeol JSON output in stdout");
    const jsonText = stdout.slice(jsonStart);
    const parsed = JSON.parse(jsonText);

    assert.ok(Array.isArray(parsed.matches));
    assert.equal(parsed.descriptor.name, "ebb");
    assert.equal(parsed.source.type, "image");
    assert.equal(parsed.distro.name, "alpine");
  });
});
