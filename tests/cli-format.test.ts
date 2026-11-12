import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCli } from "../src/cli.js";
import { isColorSupported, createColors } from "../src/cli/format/color.js";

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

describe("CLI output formatting and snapshots", () => {
  it("respects NO_COLOR and terminal color settings", () => {
    assert.equal(isColorSupported({ noColor: true }), false);
    assert.equal(isColorSupported({ color: true }), true);

    const prevNoColor = process.env.NO_COLOR;
    try {
      process.env.NO_COLOR = "1";
      assert.equal(isColorSupported(), false);
      delete process.env.NO_COLOR;
    } finally {
      if (prevNoColor !== undefined) process.env.NO_COLOR = prevNoColor;
      else delete process.env.NO_COLOR;
    }

    const cEnabled = createColors(true);
    assert.ok(cEnabled.red("test").includes("\x1b[31m"));
    assert.ok(cEnabled.green("test").includes("\x1b[32m"));

    const cDisabled = createColors(false);
    assert.equal(cDisabled.red("test"), "test");
    assert.equal(cDisabled.green("test"), "test");
  });

  it("formats check in text format with sources, replacement and offing hint", async () => {
    const mock = createMockIo();
    const code = await runCli(["check", "pkg:npm/request@2.88.2", "--no-color"], mock.io);
    assert.equal(code, 1);

    const out = mock.stdout;
    // Status line
    assert.ok(out.includes("✖ pkg:npm/request@2.88.2: deprecated"));
    // Rule line
    assert.ok(out.includes("Rule: npm.package.request.deprecated"));
    // Event line
    assert.ok(out.includes("Event: deprecated"));
    // Replacement on its own line
    assert.ok(out.includes("Replacement: Native fetch"));
    // Sources link
    assert.ok(out.includes("Sources:"));
    assert.ok(out.includes("https://www.npmjs.com/package/request"));
    // Offing hint
    assert.ok(out.includes("Offing can fix this: https://github.com/velella-sh/offing"));
  });

  it("shows days left for scheduled events in text output", async () => {
    const mock = createMockIo();
    const code = await runCli(
      ["check", "pkg:docker/library/node@22.0.0", "--as-of", "2026-01-01", "--no-color"],
      mock.io,
    );
    // Scheduled does not fail by default (fail-on defaults to deprecated)
    assert.equal(code, 0);

    const out = mock.stdout;
    assert.ok(out.includes("pkg:docker/library/node@22.0.0: scheduled"));
    assert.ok(out.includes("days left]"));
  });

  it("formats check in markdown format for PR comments", async () => {
    const mock = createMockIo();
    const code = await runCli(["check", "pkg:npm/request@2.88.2", "--format", "markdown"], mock.io);
    assert.equal(code, 1);

    const out = mock.stdout;
    assert.ok(out.includes("### Ebb Lifecycle Check: `pkg:npm/request@2.88.2`"));
    assert.ok(out.includes("| Status | Event | Days Left | Replacement | Rule |"));
    assert.ok(out.includes("❌ deprecated"));
    assert.ok(out.includes("`Native fetch or a maintained HTTP client`"));
    assert.ok(out.includes("`npm.package.request.deprecated`"));
    assert.ok(out.includes("<https://www.npmjs.com/package/request>"));
    assert.ok(out.includes("> 💡 **Offing can fix this:**"));
  });

  it("formats check-all in markdown format with summary table", async () => {
    const jsonInput = JSON.stringify(["pkg:npm/axios@1.6.0", "pkg:npm/request@2.88.2"]);
    const mock = createMockIo(jsonInput);
    const code = await runCli(["check-all", "--format", "markdown"], mock.io);
    assert.equal(code, 1);

    const out = mock.stdout;
    assert.ok(out.includes("### Ebb Lifecycle Check Summary"));
    assert.ok(out.includes("| **Total Checked** | 2 |"));
    assert.ok(out.includes("| ✅ **ok** | 1 |"));
    assert.ok(out.includes("| ❌ **deprecated** | 1 |"));
    assert.ok(out.includes("#### Findings"));
    assert.ok(out.includes("`pkg:npm/request@2.88.2`"));
    assert.ok(out.includes("`Native fetch or a maintained HTTP client`"));
    assert.ok(out.includes("> 💡 **Offing can fix this:**"));
  });

  it("suppresses hint when --no-hint or EBB_NO_HINT is passed", async () => {
    const mock1 = createMockIo();
    await runCli(["check", "pkg:npm/request@2.88.2", "--no-hint", "--no-color"], mock1.io);
    assert.equal(mock1.stdout.includes("Offing can fix this"), false);

    const prevEnv = process.env.EBB_NO_HINT;
    try {
      process.env.EBB_NO_HINT = "1";
      const mock2 = createMockIo();
      await runCli(["check", "pkg:npm/request@2.88.2", "--no-color"], mock2.io);
      assert.equal(mock2.stdout.includes("Offing can fix this"), false);
    } finally {
      if (prevEnv !== undefined) process.env.EBB_NO_HINT = prevEnv;
      else delete process.env.EBB_NO_HINT;
    }
  });

  it("enforces fail-on threshold correctly", async () => {
    // 1. Scheduled item with default fail-on (deprecated) -> exit 0
    const mock1 = createMockIo();
    const code1 = await runCli(["check", "pkg:docker/library/node@22.0.0", "--as-of", "2026-01-01"], mock1.io);
    assert.equal(code1, 0);

    // 2. Scheduled item with --fail-on scheduled -> exit 1
    const mock2 = createMockIo();
    const code2 = await runCli(
      ["check", "pkg:docker/library/node@22.0.0", "--as-of", "2026-01-01", "--fail-on", "scheduled"],
      mock2.io,
    );
    assert.equal(code2, 1);

    // 3. Deprecated item with --fail-on unsupported -> exit 0
    const mock3 = createMockIo();
    const code3 = await runCli(["check", "pkg:npm/request@2.88.2", "--fail-on", "unsupported"], mock3.io);
    assert.equal(code3, 0);

    // 4. Deprecated item with --fail-on none -> exit 0
    const mock4 = createMockIo();
    const code4 = await runCli(["check", "pkg:npm/request@2.88.2", "--fail-on", "none"], mock4.io);
    assert.equal(code4, 0);
  });
});
