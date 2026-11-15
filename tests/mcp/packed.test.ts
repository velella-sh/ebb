import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const repoRoot = resolve(".");

describe("MCP packed tarball stdio", () => {
  it("installs the packed package and runs ebb mcp initialize + check over stdio", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ebb-packed-mcp-"));
    try {
      // Pack from the built tree without re-running prepack (avoids racing other workers on dist/).
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
      const tarballPath = join(tempRoot, tarballName);

      // Empty consumer — no source tree, only the installed tarball.
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

      const installedRoot = join(appDir, "node_modules", "@velella", "ebb");
      const cliJs = join(installedRoot, "dist", "src", "cli.js");
      const mcpIndex = join(installedRoot, "dist", "src", "mcp", "index.js");
      assert.ok(
        readFileSync(cliJs, "utf8").length > 0,
        "packed tarball must include dist/src/cli.js (listed under package.json files)",
      );
      assert.ok(
        readFileSync(mcpIndex, "utf8").length > 0,
        "packed tarball must include dist/src/mcp/index.js (listed under package.json files)",
      );

      // Refuse installs that somehow resolve outside node_modules.
      assert.ok(
        cliJs.includes(`${join("node_modules", "@velella", "ebb")}`),
        `installed CLI must live under node_modules, got: ${cliJs}`,
      );

      const binEbb = join(appDir, "node_modules", ".bin", "ebb");
      const child = spawn(binEbb, ["mcp"], {
        cwd: appDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PATH: `${join(appDir, "node_modules", ".bin")}:${process.env.PATH ?? ""}` },
      });

      let stdoutBuffer = "";
      let stderrBuffer = "";
      const rawStdoutChunks: string[] = [];
      // biome-ignore lint/suspicious/noExplicitAny: JSON-RPC responses
      const responses: any[] = [];

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        rawStdoutChunks.push(text);
        stdoutBuffer += text;
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            throw new Error(`non-JSON-RPC stdout line from ebb mcp: ${JSON.stringify(line)}`);
          }
          responses.push(parsed);
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString("utf8");
      });

      // biome-ignore lint/suspicious/noExplicitAny: wait helper
      function waitForResponse(id: string | number): Promise<any> {
        return new Promise((resolvePromise, reject) => {
          const timer = setTimeout(() => {
            reject(
              new Error(
                `Timed out waiting for id ${id}. responses=${JSON.stringify(responses)} stderr=${stderrBuffer} stdout=${rawStdoutChunks.join("")}`,
              ),
            );
          }, 10000);
          const poll = () => {
            const found = responses.find((r) => r.id === id);
            if (found) {
              clearTimeout(timer);
              resolvePromise(found);
            } else {
              setTimeout(poll, 10);
            }
          };
          poll();
        });
      }

      try {
        child.stdin.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: "packed-test", version: "1.0.0" },
            },
          })}\n`,
        );
        const initResp = await waitForResponse(1);
        assert.equal(initResp.result.serverInfo.name, "@velella/ebb");
        assert.equal(initResp.jsonrpc, "2.0");

        child.stdin.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "check",
              arguments: { purl: "pkg:npm/request@2.88.2" },
            },
          })}\n`,
        );
        const checkResp = await waitForResponse(2);
        assert.equal(checkResp.result.isError, false);
        const payload = JSON.parse(checkResp.result.content[0].text);
        assert.equal(payload.status, "deprecated");

        // Every completed stdout line must have been valid JSON-RPC (enforced above).
        assert.ok(responses.length >= 2);
        assert.equal(stderrBuffer, "", `unexpected stderr: ${stderrBuffer}`);
      } finally {
        child.stdin.end();
        if (child.exitCode === null && !child.killed) {
          child.kill("SIGKILL");
        }
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
