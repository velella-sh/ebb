import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { StdioJsonRpcSession } from "./stdio-wait.js";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const repoRoot = resolve(".");
const rootPkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
  name: string;
  version: string;
};

function expectedTarballName(version: string): string {
  // npm pack renames @scope/name@version → scope-name-version.tgz
  return `velella-ebb-${version}.tgz`;
}

function listNonNodeModulesEntries(appDir: string): string[] {
  const allowed = new Set(["package.json", "package-lock.json", "node_modules"]);
  return readdirSync(appDir).filter((name) => !allowed.has(name));
}

describe("MCP packed tarball stdio", () => {
  it("installs the packed package and runs ebb mcp initialize + check over stdio", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ebb-packed-mcp-"));
    let child: ChildProcessWithoutNullStreams | undefined;
    let session: StdioJsonRpcSession | undefined;
    try {
      const packStdout = execFileSync(
        npmCmd,
        ["pack", "--silent", "--ignore-scripts", "--pack-destination", tempRoot],
        {
          cwd: repoRoot,
          encoding: "utf8",
        },
      ).trim();
      const tarballName = packStdout.split(/\r?\n/).filter(Boolean).at(-1);
      assert.ok(tarballName, `expected npm pack output, got: ${packStdout}`);
      assert.equal(tarballName, expectedTarballName(rootPkg.version));
      const tarballPath = join(tempRoot, tarballName);

      const appDir = join(tempRoot, "app");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "package.json"),
        JSON.stringify({ name: "ebb-packed-mcp-consumer", version: "1.0.0", private: true, type: "module" }, null, 2),
      );

      execFileSync(npmCmd, ["install", "--prefer-offline", "--no-audit", "--no-fund", tarballPath], {
        cwd: appDir,
        stdio: "pipe",
      });

      const outside = listNonNodeModulesEntries(appDir);
      assert.deepEqual(outside, [], `install must not create files outside node_modules; found: ${outside.join(", ")}`);
      assert.ok(statSync(join(appDir, "node_modules", "@velella", "ebb")).isDirectory());

      const installedRoot = join(appDir, "node_modules", "@velella", "ebb");
      const installedPkg = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8")) as {
        name: string;
        version: string;
      };
      assert.equal(installedPkg.version, rootPkg.version);
      assert.equal(installedPkg.name, rootPkg.name);
      assert.ok(readFileSync(join(installedRoot, "dist", "src", "cli.js"), "utf8").length > 0);
      assert.ok(readFileSync(join(installedRoot, "dist", "src", "mcp", "index.js"), "utf8").length > 0);

      const binEbb = join(appDir, "node_modules", ".bin", "ebb");
      const purl = "pkg:npm/request@2.88.2";
      const canonicalUrl = "https://velella.sh/ebb/rules/npm-package-request-deprecated/";
      const source = "https://www.npmjs.com/package/request";
      function cli(...options: string[]): string {
        return execFileSync(binEbb, ["check", purl, "--fail-on", "never", ...options], {
          cwd: appDir,
          encoding: "utf8",
        });
      }
      const text = cli();
      assert.ok(text.includes(`Lifecycle evidence: ${canonicalUrl}`));
      assert.ok(text.includes(source));
      assert.ok(cli("--format", "markdown").includes(`(${canonicalUrl})`));
      const json = JSON.parse(cli("--json"));
      assert.equal(json.schemaVersion, 1);
      assert.equal(json.matches[0].ruleId, "npm.package.request.deprecated");
      assert.equal(Object.hasOwn(json.matches[0], "canonicalUrl"), false);

      child = spawn(binEbb, ["mcp"], {
        cwd: appDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PATH: `${join(appDir, "node_modules", ".bin")}:${process.env.PATH ?? ""}` },
      });
      session = new StdioJsonRpcSession(child, { timeoutMs: 10000 });

      session.write({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "packed-test", version: "1.0.0" },
        },
      });
      const initResp = (await session.waitForResponse(1)) as {
        jsonrpc: string;
        result: { serverInfo: { name: string; version: string } };
      };
      assert.equal(initResp.jsonrpc, "2.0");
      assert.equal(initResp.result.serverInfo.name, installedPkg.name);
      assert.equal(
        initResp.result.serverInfo.version,
        installedPkg.version,
        "handshake serverInfo.version must match installed package.json",
      );

      session.write({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "check",
          arguments: { purl },
        },
      });
      const checkResp = (await session.waitForResponse(2)) as {
        result: { isError: boolean; content: Array<{ text: string }>; structuredContent: unknown };
      };
      assert.equal(checkResp.result.isError, false);
      const payload = JSON.parse(checkResp.result.content[0]!.text) as {
        status: string;
        matches: Array<{ canonicalUrl?: string; sources: Array<{ url: string }> }>;
      };
      assert.equal(payload.status, "deprecated");
      assert.equal(payload.matches[0]?.canonicalUrl, canonicalUrl);
      assert.ok(payload.matches[0]?.sources.some(({ url }) => url === source));
      assert.deepEqual(checkResp.result.structuredContent, payload);

      await session.finish();
      assert.ok(session.allResponses.length >= 2);
      assert.equal(session.stderr, "", `unexpected stderr: ${session.stderr}`);
    } finally {
      if (session) {
        await session.dispose();
      } else if (child && child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
