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

function extractAgentTab(mcpDoc: string, agent: string): string {
  const start = `<!-- mcp-print-config:${agent} -->`;
  const end = `<!-- /mcp-print-config:${agent} -->`;
  const from = mcpDoc.indexOf(start);
  const to = mcpDoc.indexOf(end);
  assert.ok(from >= 0, `docs/mcp.md missing start marker for ${agent}`);
  assert.ok(to > from, `docs/mcp.md missing end marker for ${agent}`);
  const block = mcpDoc.slice(from + start.length, to);
  const fence = block.match(/```text\n([\s\S]*?)```/);
  assert.ok(fence, `docs/mcp.md missing text fence for ${agent}`);
  return fence[1]!;
}

describe("MCP docs", () => {
  it("compares each docs/mcp.md agent tab to CLI --print-config output", () => {
    const mcpDoc = readFileSync(resolve(root, "docs/mcp.md"), "utf8");
    for (const agent of MCP_PRINT_CONFIG_AGENTS) {
      const fromDocs = extractAgentTab(mcpDoc, agent);
      const fromCli = printMcpConfig(agent);
      assert.equal(fromDocs, fromCli, `docs tab for ${agent} drifted from CLI`);
    }
  });

  it("starts troubleshooting with self-test and documents a temp-cache npx fix", () => {
    const mcpDoc = readFileSync(resolve(root, "docs/mcp.md"), "utf8");
    const troubleshooting = mcpDoc.slice(mcpDoc.indexOf("## Troubleshooting"));
    assert.match(troubleshooting, /^## Troubleshooting\n\nStart here[\s\S]*npx -y @velella\/ebb mcp --self-test/);
    assert.match(troubleshooting, /NPM_CONFIG_CACHE=\$\(mktemp -d\)/);
    assert.match(troubleshooting, /Release smoke \(after publish\)/);
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
