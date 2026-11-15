import assert from "node:assert/strict";
import { execFileSync, type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const repoRoot = resolve(".");

function listNonNodeModulesEntries(appDir: string): string[] {
  const allowed = new Set(["package.json", "package-lock.json", "node_modules"]);
  return readdirSync(appDir).filter((name) => !allowed.has(name));
}

describe("MCP packed tarball stdio", () => {
  it("installs the packed package and runs ebb mcp initialize + check over stdio", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ebb-packed-mcp-"));
    let child: ChildProcessWithoutNullStreams | undefined;
    let timer: NodeJS.Timeout | undefined;
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
      const tarballPath = join(tempRoot, tarballName);
      assert.match(tarballName, /velella-ebb-0\.3\.0\.tgz$/);

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
      const pkg = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8")) as { version: string };
      assert.equal(pkg.version, "0.3.0");
      assert.ok(readFileSync(join(installedRoot, "dist", "src", "cli.js"), "utf8").length > 0);
      assert.ok(readFileSync(join(installedRoot, "dist", "src", "mcp", "index.js"), "utf8").length > 0);

      const binEbb = join(appDir, "node_modules", ".bin", "ebb");
      child = spawn(binEbb, ["mcp"], {
        cwd: appDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PATH: `${join(appDir, "node_modules", ".bin")}:${process.env.PATH ?? ""}` },
      });

      let stdoutBuffer = "";
      let stderrBuffer = "";
      let raw = "";
      // biome-ignore lint/suspicious/noExplicitAny: JSON-RPC responses
      const responses: any[] = [];

      const validateStdoutLine = (line: string) => {
        if (!line.trim()) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          throw new Error(`non-JSON-RPC stdout line from ebb mcp: ${JSON.stringify(line)}`);
        }
        assert.equal(typeof parsed, "object");
        assert.ok(parsed !== null);
        const msg = parsed as { jsonrpc?: string };
        assert.equal(msg.jsonrpc, "2.0", `stdout line missing jsonrpc 2.0: ${line}`);
        responses.push(parsed);
      };

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        raw += text;
        stdoutBuffer += text;
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) {
          validateStdoutLine(line);
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString("utf8");
      });

      // biome-ignore lint/suspicious/noExplicitAny: wait helper
      function waitForResponse(id: string | number): Promise<any> {
        return new Promise((resolvePromise, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                `Timed out waiting for id ${id}. responses=${JSON.stringify(responses)} stderr=${stderrBuffer} stdout=${raw}`,
              ),
            );
          }, 10000);
          const poll = () => {
            const found = responses.find((r) => r.id === id);
            if (found) {
              if (timer) clearTimeout(timer);
              timer = undefined;
              resolvePromise(found);
            } else {
              setTimeout(poll, 10);
            }
          };
          poll();
        });
      }

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
      assert.equal(initResp.result.serverInfo.version, "0.3.0");
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

      child.stdin.end();
      await new Promise<void>((resolveClose) => {
        child?.once("close", () => resolveClose());
        setTimeout(() => resolveClose(), 500);
      });
      if (stdoutBuffer.trim()) {
        validateStdoutLine(stdoutBuffer);
        stdoutBuffer = "";
      }
      assert.ok(responses.length >= 2);
      assert.equal(stderrBuffer, "", `unexpected stderr: ${stderrBuffer}`);
    } finally {
      if (timer) clearTimeout(timer);
      if (child && child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
        await new Promise<void>((resolveClose) => {
          child?.once("close", () => resolveClose());
          setTimeout(() => resolveClose(), 1000);
        });
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
