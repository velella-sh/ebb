import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("skills.sh specification & documentation", () => {
  const skillJsonPath = resolve(process.cwd(), "skills/ebb/skill.json");
  const docsPath = resolve(process.cwd(), "docs/skills.md");

  it("contains valid skills.sh manifest under velella-sh owner", () => {
    assert.ok(existsSync(skillJsonPath), "skills/ebb/skill.json must exist");
    const manifest = JSON.parse(readFileSync(skillJsonPath, "utf8"));

    assert.equal(manifest.name, "ebb");
    assert.equal(manifest.owner, "velella-sh");
    assert.equal(manifest.entrypoint, "SKILL.md");
    assert.equal(manifest.install.command, "npx skills add velella-sh/ebb");
    assert.ok(Array.isArray(manifest.tags));
  });

  it("documents skills.sh installation in docs/skills.md", () => {
    assert.ok(existsSync(docsPath), "docs/skills.md must exist");
    const content = readFileSync(docsPath, "utf8");

    assert.ok(content.includes("npx skills add velella-sh/ebb"), "Includes quick install command");
    assert.ok(content.includes("Claude Code"), "Includes Claude Code guidance");
    assert.ok(content.includes("Cursor"), "Includes Cursor guidance");
    assert.ok(content.includes("Gemini"), "Includes Gemini guidance");
  });
});
