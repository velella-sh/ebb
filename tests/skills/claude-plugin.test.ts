import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Claude Code Plugin Packaging", () => {
  const pluginJsonPath = resolve(process.cwd(), "skills/ebb/.claude-plugin.json");
  const packageJsonPath = resolve(process.cwd(), "skills/ebb/package.json");

  it("includes valid .claude-plugin.json manifest", () => {
    assert.ok(existsSync(pluginJsonPath), ".claude-plugin.json must exist");
    const manifest = JSON.parse(readFileSync(pluginJsonPath, "utf8"));

    assert.equal(manifest.name, "ebb");
    assert.ok(manifest.version);
    assert.ok(manifest.description);
    assert.deepEqual(manifest.skills, ["./SKILL.md"]);
  });

  it("includes valid package.json with skill files declaration", () => {
    assert.ok(existsSync(packageJsonPath), "skills/ebb/package.json must exist");
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));

    assert.equal(pkg.name, "@velella/ebb-skill");
    assert.ok(pkg.files.includes("SKILL.md"));
    assert.ok(pkg.files.includes(".claude-plugin.json"));
  });
});
