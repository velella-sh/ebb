import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Agent Skill SKILL.md", () => {
  const skillPath = resolve(process.cwd(), "skills/ebb/SKILL.md");

  it("exists and is readable", () => {
    assert.ok(existsSync(skillPath), "skills/ebb/SKILL.md must exist");
  });

  it("contains valid YAML frontmatter with name and description", () => {
    const content = readFileSync(skillPath, "utf8");
    assert.ok(content.startsWith("---\n"), "SKILL.md must start with frontmatter delimiter");

    const closingIndex = content.indexOf("\n---\n", 4);
    assert.ok(closingIndex !== -1, "SKILL.md must have closing frontmatter delimiter");

    const frontmatter = content.slice(4, closingIndex);
    assert.match(frontmatter, /^name:\s*ebb\s*$/m, "Frontmatter must define name: ebb");
    assert.match(frontmatter, /^description:\s*.+$/m, "Frontmatter must define description");
  });

  it("documents essential agent workflows", () => {
    const content = readFileSync(skillPath, "utf8");
    assert.ok(content.includes("check"), "Documents check tool / API");
    assert.ok(content.includes("checkAll") || content.includes("check_all"), "Documents batch check");
    assert.ok(content.includes("replacement_for") || content.includes("replacementFor"), "Documents replacement");
    assert.ok(content.includes("Strict Guidelines"), "Includes strict response guidelines");
    assert.ok(content.includes("Detect and Verify Project Runtimes"), "Includes runtime detection step");
    assert.ok(content.includes("Check New Packages Before Installation"), "Includes package installation step");
    assert.ok(content.includes(".nvmrc"), "Mentions .nvmrc detection");
    assert.ok(content.includes("Dockerfile"), "Mentions Dockerfile detection");
    assert.ok(content.includes("pkg:npm/"), "Mentions PURL formats for npm");
    assert.ok(content.includes("pkg:pypi/"), "Mentions PURL formats for pypi");
  });
});
