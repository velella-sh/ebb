import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import { extractPurlAndVersion, parseCheckAllInput, runCli } from "../src/cli.js";
import { VERSION } from "../src/version.js";

const execFileAsync = promisify(execFile);
const cliPath = resolve(process.cwd(), "dist/src/cli.js");

function createMockIo(stdinData?: string) {
  let stdoutData = "";
  let stderrData = "";

  const stdout = {
    write(str: string) {
      stdoutData += str;
      return true;
    },
  };

  const stderr = {
    write(str: string) {
      stderrData += str;
      return true;
    },
  };

  async function* stdinGen() {
    if (stdinData !== undefined) {
      yield Buffer.from(stdinData, "utf8");
    }
  }

  return {
    io: {
      stdout,
      stderr,
      stdin: stdinGen(),
    },
    get stdout() {
      return stdoutData;
    },
    get stderr() {
      return stderrData;
    },
  };
}

describe("CLI - unit parsing", () => {
  it("extracts purl and version correctly", () => {
    assert.deepEqual(extractPurlAndVersion("pkg:npm/request@2.88.2"), {
      purl: "pkg:npm/request",
      version: "2.88.2",
    });

    assert.deepEqual(extractPurlAndVersion("pkg:npm/request", "2.88.2"), {
      purl: "pkg:npm/request",
      version: "2.88.2",
    });

    assert.deepEqual(extractPurlAndVersion("node", "18.0.0"), {
      purl: "node",
      version: "18.0.0",
    });

    assert.deepEqual(extractPurlAndVersion("node"), {
      purl: "node",
      version: undefined,
    });
  });

  it("parses check-all json array input", () => {
    const raw = JSON.stringify(["pkg:npm/request@2.88.2", "pkg:generic/nodejs@24.0.0"]);
    const items = parseCheckAllInput(raw);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.purl, "pkg:npm/request");
    assert.equal(items[0]?.version, "2.88.2");
  });

  it("parses check-all CycloneDX input", () => {
    const raw = JSON.stringify({
      bomFormat: "CycloneDX",
      components: [{ purl: "pkg:npm/request@2.88.2" }, { purl: "pkg:generic/nodejs", version: "24.0.0" }],
    });
    const items = parseCheckAllInput(raw);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.purl, "pkg:npm/request");
    assert.equal(items[0]?.version, "2.88.2");
    assert.equal(items[1]?.purl, "pkg:generic/nodejs");
    assert.equal(items[1]?.version, "24.0.0");
  });

  it("parses check-all newline-separated input", () => {
    const raw = "# comment\npkg:npm/request@2.88.2\n\npkg:generic/nodejs@24.0.0\n";
    const items = parseCheckAllInput(raw);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.purl, "pkg:npm/request");
    assert.equal(items[0]?.version, "2.88.2");
  });
});

describe("CLI - runCli commands", () => {
  it("prints version on --version", async () => {
    const mock = createMockIo();
    const code = await runCli(["--version"], mock.io);
    assert.equal(code, 0);
    assert.equal(mock.stdout.trim(), `ebb ${VERSION}`);
  });

  it("prints help on --help", async () => {
    const mock = createMockIo();
    const code = await runCli(["--help"], mock.io);
    assert.equal(code, 0);
    assert.match(mock.stdout, /The open almanac of software end-of-life/);
    assert.match(mock.stdout, /Usage:/);
  });

  it("returns 0 for clean package on check", async () => {
    const mock = createMockIo();
    const code = await runCli(["check", "pkg:generic/nodejs@24.0.0", "--as-of", "2026-04-01"], mock.io);
    assert.equal(code, 0);
    assert.match(mock.stdout, /is ok/);
  });

  it("returns 1 for deprecated package on check", async () => {
    const mock = createMockIo();
    const code = await runCli(["check", "pkg:npm/request@2.88.2", "--as-of", "2026-04-01"], mock.io);
    assert.equal(code, 1);
    assert.match(mock.stdout, /deprecated/);
    assert.match(mock.stdout, /Rule:/);
  });

  it("supports --json output on check", async () => {
    const mock = createMockIo();
    const code = await runCli(["check", "pkg:npm/request@2.88.2", "--json"], mock.io);
    assert.equal(code, 1);
    const parsed = JSON.parse(mock.stdout);
    assert.equal(parsed.status, "deprecated");
    assert.equal(parsed.version, "2.88.2");
  });

  it("supports shorthand command format", async () => {
    const mock = createMockIo();
    const code = await runCli(["pkg:npm/request@2.88.2", "--json"], mock.io);
    assert.equal(code, 1);
    const parsed = JSON.parse(mock.stdout);
    assert.equal(parsed.status, "deprecated");
  });

  it("returns 2 on missing version", async () => {
    const mock = createMockIo();
    const code = await runCli(["check", "pkg:npm/request"], mock.io);
    assert.equal(code, 2);
    assert.match(mock.stderr, /Version is required/);
  });

  it("returns 2 on invalid purl", async () => {
    const mock = createMockIo();
    const code = await runCli(["check", "pkg:invalid/??", "1.0.0"], mock.io);
    assert.equal(code, 2);
    assert.match(mock.stderr, /Error:/);
  });

  it("returns 2 on unknown command", async () => {
    const mock = createMockIo();
    const code = await runCli(["unknown-cmd"], mock.io);
    assert.equal(code, 2);
    assert.match(mock.stderr, /Unknown command/);
  });

  it("runs check-all over stdin", async () => {
    const input = JSON.stringify(["pkg:npm/request@2.88.2", "pkg:generic/nodejs@24.0.0"]);
    const mock = createMockIo(input);
    const code = await runCli(["check-all", "-", "--json", "--as-of", "2026-04-01"], mock.io);
    assert.equal(code, 1); // has 1 deprecated package
    const parsed = JSON.parse(mock.stdout);
    assert.equal(parsed.results.length, 2);
    assert.equal(parsed.summary.total, 2);
    assert.equal(parsed.summary.byStatus.deprecated, 1);
    assert.equal(parsed.summary.byStatus.ok, 1);
  });

  it("runs replacement command", async () => {
    const mock = createMockIo();
    const code = await runCli(["replacement", "pkg:npm/request@2.88.2"], mock.io);
    assert.equal(code, 0);
    assert.match(mock.stdout, /Native fetch or a maintained HTTP client/);
  });

  it("runs replacement command with --json", async () => {
    const mock = createMockIo();
    const code = await runCli(["replacement", "pkg:npm/request@2.88.2", "--json"], mock.io);
    assert.equal(code, 0);
    const parsed = JSON.parse(mock.stdout);
    assert.match(parsed.replacement, /fetch/);
  });

  it("returns 1 for replacement when none exists", async () => {
    const mock = createMockIo();
    const code = await runCli(["replacement", "pkg:generic/nodejs@24.0.0"], mock.io);
    assert.equal(code, 1);
    assert.match(mock.stdout, /No suggested replacement/);
  });

  it("runs rules command", async () => {
    const mock = createMockIo();
    const code = await runCli(["rules", "pkg:npm/request"], mock.io);
    assert.equal(code, 0);
    assert.match(mock.stdout, /npm\.package\.request\.deprecated/);
  });
});

describe("CLI - end-to-end binary execution", () => {
  it("executes CLI process via node", async () => {
    try {
      await execFileAsync("node", [cliPath, "check", "pkg:npm/request@2.88.2", "--json"]);
      assert.fail("Should have exited with code 1");
    } catch (err: unknown) {
      const execErr = err as { code: number; stdout: string };
      assert.equal(execErr.code, 1);
      const parsed = JSON.parse(execErr.stdout);
      assert.equal(parsed.status, "deprecated");
    }
  });

  it("executes CLI --version via node", async () => {
    const { stdout } = await execFileAsync("node", [cliPath, "--version"]);
    assert.equal(stdout.trim(), `ebb ${VERSION}`);
  });
});
