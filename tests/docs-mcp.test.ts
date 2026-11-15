import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { MCP_PRINT_CONFIG_AGENTS, printMcpConfig } from "../src/cli/mcp-config.js";

const root = resolve(process.cwd());
const forbiddenLegacyName = ["ebb", "mcp"].join("-");
const forbiddenLegacyPackage = `@velella/${forbiddenLegacyName}`;

const DOC_PATHS = [
  "docs/mcp.md",
  "docs/QUICKSTART.md",
  "docs/upcoming.md",
  "README.md",
  "skills/ebb/SKILL.md",
  "llms.txt",
  "llms-full.txt",
] as const;

describe("MCP docs", () => {
  it("documents every --print-config agent with generated snippets", () => {
    const mcpDoc = readFileSync(resolve(root, "docs/mcp.md"), "utf8");
    for (const agent of MCP_PRINT_CONFIG_AGENTS) {
      assert.ok(mcpDoc.includes(`\`${agent}\``) || mcpDoc.includes(agent), `docs/mcp.md missing ${agent}`);
      const snippet = printMcpConfig(agent).trim();
      assert.ok(mcpDoc.includes(snippet), `docs/mcp.md missing generated snippet for ${agent}`);
    }
  });

  it("fails if the retired MCP package name remains in tracked docs or code", () => {
    const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .filter((path) => !path.startsWith("tests/importers/recordings/"))
      .filter((path) => path !== "tests/docs-mcp.test.ts");

    const offenders: string[] = [];
    for (const path of tracked) {
      if (/CHANGELOG/i.test(path) || path === "DATA-CHANGELOG.md") continue;
      let content: string;
      try {
        content = readFileSync(resolve(root, path), "utf8");
      } catch {
        continue;
      }
      if (content.includes(forbiddenLegacyName) || content.includes(forbiddenLegacyPackage)) {
        offenders.push(path);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `retired MCP package name must be removed from tracked files, found in:\n${offenders.join("\n")}`,
    );

    for (const path of DOC_PATHS) {
      const content = readFileSync(resolve(root, path), "utf8");
      assert.ok(!content.includes(forbiddenLegacyName), `${path} still mentions retired MCP package name`);
    }
  });
});
