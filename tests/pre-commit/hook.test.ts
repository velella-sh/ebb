import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { runCli } from "../../src/cli.js";

function createMockIo(input = ""): {
  io: {
    stdin: AsyncIterable<Buffer>;
    stdout: { write: (chunk: string) => void };
    stderr: { write: (chunk: string) => void };
  };
  getStdout: () => string;
  getStderr: () => string;
} {
  let stdoutData = "";
  let stderrData = "";

  const stdin = (async function* () {
    if (input) yield Buffer.from(input, "utf8");
  })();

  return {
    io: {
      stdin,
      stdout: {
        write: (chunk: string) => {
          stdoutData += chunk;
        },
      },
      stderr: {
        write: (chunk: string) => {
          stderrData += chunk;
        },
      },
    },
    getStdout: () => stdoutData,
    getStderr: () => stderrData,
  };
}

describe("Pre-commit hook CLI execution (hook.test.ts)", () => {
  const passFile = resolve(process.cwd(), "examples/pre-commit/sbom-pass.json");
  const failFile = resolve(process.cwd(), "examples/pre-commit/sbom-fail.json");
  const purlsFile = resolve(process.cwd(), "examples/pre-commit/.ebb-purls");

  it("passes when checking valid maintained SBOM", async () => {
    const mock = createMockIo();
    const code = await runCli(["check-all", passFile, "--fail-on", "end-of-life"], mock.io);
    assert.equal(code, 0, "Pass SBOM should exit with 0");
    assert.match(mock.getStdout(), /Summary \(2 total\)/);
  });

  it("fails when checking SBOM with end-of-life component and names component, rule, and source", async () => {
    const mock = createMockIo();
    const code = await runCli(["check-all", failFile, "--fail-on", "end-of-life"], mock.io);
    assert.equal(code, 1, "Fail SBOM should exit with 1 on end-of-life threshold");

    const stdout = mock.getStdout();
    // Names component
    assert.match(stdout, /node-sass/, "Output must name the component");
    // Names rule
    assert.match(stdout, /npm\.package\.node-sass\.eol/, "Output must name the rule ID");
    // Names source URL
    assert.match(stdout, /Source:\s+https?:\/\//, "Output must name the evidence source URL");
  });

  it("runs hook with several file names as pre-commit passes them", async () => {
    const mock = createMockIo();
    const code = await runCli(["check-all", passFile, failFile, "--fail-on", "end-of-life"], mock.io);
    assert.equal(code, 1, "Checking pass and fail files together should exit with 1");

    const stdout = mock.getStdout();
    assert.match(stdout, /Summary \(3 total\)/, "Summary must include components from both files");
    assert.match(stdout, /node-sass/, "Output must include failing component");
    assert.match(stdout, /express/, "Output must include passing component");
  });

  it("passes on purl list file (.ebb-purls)", async () => {
    const mock = createMockIo();
    const code = await runCli(["check-all", purlsFile, "--fail-on", "end-of-life"], mock.io);
    assert.equal(code, 0, "Purl list should exit with 0");
  });

  it("fails clearly with exit code 2 on unreadable file", async () => {
    const mock = createMockIo();
    const unreadable = resolve(process.cwd(), "nonexistent-missing-file.json");
    const code = await runCli(["check-all", unreadable, "--fail-on", "end-of-life"], mock.io);
    assert.equal(code, 2, "Unreadable file must exit with code 2");
    assert.match(mock.getStderr(), /Error reading file/, "Stderr must describe read error");
    assert.match(mock.getStderr(), /nonexistent-missing-file\.json/, "Stderr must name the unreadable file");
  });
});
