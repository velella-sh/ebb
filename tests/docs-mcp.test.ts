import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { MCP_PRINT_CONFIG_AGENTS, getMcpAgentConfig } from "../src/cli/mcp-config.js";

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

const AGENT_TITLES: Record<(typeof MCP_PRINT_CONFIG_AGENTS)[number], string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  gemini: "Gemini CLI",
  vscode: "VS Code",
  windsurf: "Windsurf",
  zed: "Zed",
};

function extractAgentTabSnippet(mcpDoc: string, agent: string): string {
  const start = `<!-- mcp-print-config:${agent} -->`;
  const end = `<!-- /mcp-print-config:${agent} -->`;
  const from = mcpDoc.indexOf(start);
  const to = mcpDoc.indexOf(end);
  assert.ok(from >= 0, `docs/mcp.md missing start marker for ${agent}`);
  assert.ok(to > from, `docs/mcp.md missing end marker for ${agent}`);
  const block = mcpDoc.slice(from + start.length, to);
  const fence = block.match(/```(?:bash|json|toml|text)?\n([\s\S]*?)```/);
  assert.ok(fence, `docs/mcp.md missing code fence for ${agent}`);
  return fence[1]!;
}

describe("MCP docs", () => {
  it("uses a real code-tabs block covering every agent", () => {
    const mcpDoc = readFileSync(resolve(root, "docs/mcp.md"), "utf8");
    assert.match(mcpDoc, /:::code-tabs\{labels='/);
    const labelsMatch = mcpDoc.match(/:::code-tabs\{labels='(\[[^\]]+\])'\}/);
    assert.ok(labelsMatch, "code-tabs labels missing");
    const labels = JSON.parse(labelsMatch[1]!) as string[];
    assert.deepEqual(
      labels,
      MCP_PRINT_CONFIG_AGENTS.map((a) => AGENT_TITLES[a]),
    );
    assert.match(mcpDoc, /\| Agent \| Config path \/ command scope \|/);
  });

  it("compares each docs/mcp.md agent tab to the CLI snippet for that client", () => {
    const mcpDoc = readFileSync(resolve(root, "docs/mcp.md"), "utf8");
    for (const agent of MCP_PRINT_CONFIG_AGENTS) {
      const fromDocs = extractAgentTabSnippet(mcpDoc, agent);
      const fromCli = getMcpAgentConfig(agent).snippet;
      assert.equal(fromDocs, fromCli, `docs tab for ${agent} drifted from CLI snippet`);
      // Path stays outside the copyable fence.
      assert.ok(!fromDocs.startsWith("Path:"), `${agent} tab must not embed the Path line`);
      assert.match(mcpDoc, new RegExp(`\\| ${AGENT_TITLES[agent].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|`));
    }
  });

  it("starts troubleshooting with self-test and documents a temp-cache npx fix", () => {
    const mcpDoc = readFileSync(resolve(root, "docs/mcp.md"), "utf8");
    const troubleshooting = mcpDoc.slice(mcpDoc.indexOf("## Troubleshooting"));
    assert.match(troubleshooting, /^## Troubleshooting\n\nStart here[\s\S]*npx -y @velella\/ebb mcp --self-test/);
    assert.match(troubleshooting, /NPM_CONFIG_CACHE=\$\(mktemp -d\)/);
    assert.match(troubleshooting, /Release smoke \(after publish\)/);
    assert.match(troubleshooting, /npx -y @velella\/ebb mcp\n/);
    assert.match(troubleshooting, /serverInfo\.version/);
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
