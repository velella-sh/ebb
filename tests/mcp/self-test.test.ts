import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { runCli } from "../../src/cli.js";
import { configureActiveData } from "../../src/data-source.js";
import { dataStatus } from "../../src/data-status.js";
import { runMcpSelfTest } from "../../src/mcp/self-test.js";
import { VERSION } from "../../src/version.js";

function createIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: {
        write(str: string) {
          stdout += str;
          return true;
        },
      },
      stderr: {
        write(str: string) {
          stderr += str;
          return true;
        },
      },
    },
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}

describe("ebb mcp --self-test", () => {
  afterEach(() => {
    configureActiveData({});
  });

  it("runs the known check through the MCP tool handler and prints package + data versions", async () => {
    const result = await runMcpSelfTest();
    assert.equal(result.ok, true);
    const status = dataStatus();
    assert.equal(result.line, `ebb mcp self-test ok (@velella/ebb ${VERSION}, data ${status.version})`);
  });

  it("exits 0 through the CLI without starting the stdio loop", async () => {
    const mock = createIo();
    const code = await runCli(["mcp", "--self-test"], mock.io);
    assert.equal(code, 0);
    assert.match(mock.stdout, /^ebb mcp self-test ok \(@velella\/ebb /);
    assert.equal(mock.stderr, "");
  });

  it("exits 1 with a clear stderr reason when data is broken", async () => {
    const broken = mkdtempSync(join(tmpdir(), "ebb-broken-data-"));
    try {
      // A pin that is not in the cache is an error (no quiet fallback to bundled).
      configureActiveData({ cacheDirectory: broken, pinnedVersion: "2099.01.01" });

      const result = await runMcpSelfTest();
      assert.equal(result.ok, false);
      assert.match(result.error ?? "", /self-test failed:/);

      const mock = createIo();
      const code = await runCli(["mcp", "--self-test"], mock.io);
      assert.equal(code, 1);
      assert.equal(mock.stdout, "");
      assert.match(mock.stderr, /self-test failed:/);
      assert.match(mock.stderr, /2099\.01\.01|pinned|not in/i);
    } finally {
      configureActiveData({});
      rmSync(broken, { recursive: true, force: true });
    }
  });
});
