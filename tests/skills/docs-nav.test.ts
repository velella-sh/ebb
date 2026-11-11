import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Agent Skills docs navigation & package distribution", () => {
  it("includes /skills/ in docs navigation", () => {
    const navPath = resolve(process.cwd(), "docs/_data/navigation.yml");
    const navContent = readFileSync(navPath, "utf8");

    assert.ok(navContent.includes("url: /skills/"), "docs/_data/navigation.yml must link to /skills/");
    assert.ok(navContent.includes("Agent Skills"), "docs/_data/navigation.yml must title the link Agent Skills");
  });

  it("includes skills in package.json files list", () => {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

    assert.ok(pkg.files.includes("skills"), "package.json files must include skills");
  });
});
