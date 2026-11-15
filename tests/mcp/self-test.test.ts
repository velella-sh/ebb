import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCli } from "../../src/cli.js";
import { runMcpSelfTest } from "../../src/mcp/self-test.js";
import { VERSION } from "../../src/version.js";
import { dataStatus } from "../../src/data-status.js";

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
  it("loads data, runs one known check, and prints package + data versions", () => {
    const result = runMcpSelfTest();
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
});
