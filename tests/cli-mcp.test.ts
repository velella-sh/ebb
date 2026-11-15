import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";

const cliPath = resolve(process.cwd(), "dist/src/cli.js");
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
  name: string;
  version: string;
};

describe("CLI mcp subcommand", () => {
  it("spawns ebb mcp and answers initialize with package name and version", async () => {
    const child = spawn(process.execPath, [cliPath, "mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    // biome-ignore lint/suspicious/noExplicitAny: JSON-RPC response inspection
    const responses: any[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          responses.push(JSON.parse(line));
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf8");
    });

    // biome-ignore lint/suspicious/noExplicitAny: response wait helper
    function waitForResponse(id: string | number): Promise<any> {
      return new Promise((resolvePromise, reject) => {
        const timer = setTimeout(() => {
          reject(
            new Error(
              `Timed out waiting for response id ${id}. Responses: ${JSON.stringify(responses)}. stderr: ${stderrBuffer}`,
            ),
          );
        }, 5000);
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
            clientInfo: { name: "cli-mcp-test", version: "1.0.0" },
          },
        })}\n`,
      );

      const initResp = await waitForResponse(1);
      assert.equal(initResp.result.serverInfo.name, pkg.name);
      assert.equal(initResp.result.serverInfo.version, pkg.version);
      assert.equal(initResp.result.protocolVersion, "2024-11-05");
      assert.equal(stderrBuffer, "");
    } finally {
      child.stdin.end();
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
    }
  });

  it("does not load src/mcp when running ebb check", async () => {
    const cliSource = readFileSync(cliPath, "utf8");
    assert.match(cliSource, /import\(["']\.\/mcp\/index\.js["']\)/);
    assert.doesNotMatch(cliSource, /^import\s+.+from\s+["']\.\/mcp\//m);

    const tempDir = mkdtempSync(join(tmpdir(), "ebb-cli-load-"));
    const logPath = join(tempDir, "mcp-loads.txt");
    const probePath = join(tempDir, "probe.mjs");
    writeFileSync(logPath, "");
    writeFileSync(
      probePath,
      `
import { registerHooks } from "node:module";
import { appendFileSync } from "node:fs";

const logPath = ${JSON.stringify(logPath)};
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    const url = typeof result.url === "string" ? result.url : "";
    if (/[/\\\\]mcp[/\\\\]/.test(url) || /[/\\\\]mcp\\.js$/.test(url)) {
      appendFileSync(logPath, url + "\\n");
    }
    return result;
  },
});
`,
    );

    try {
      const child = spawn(
        process.execPath,
        ["--import", pathToFileURL(probePath).href, cliPath, "check", "pkg:npm/request@2.88.2", "--format", "json"],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      const exitCode = await new Promise<number>((resolvePromise, reject) => {
        child.on("error", reject);
        child.on("close", (code) => resolvePromise(code ?? 1));
      });

      assert.equal(exitCode, 1);
      assert.ok(stdout.includes('"status"'), `expected check JSON on stdout, got: ${stdout.slice(0, 200)}`);
      assert.equal(stderr, "", `unexpected stderr: ${stderr}`);
      const loads = readFileSync(logPath, "utf8").trim();
      assert.equal(loads, "", `ebb check must not load MCP modules, but loaded:\n${loads}`);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
