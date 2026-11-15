import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  ensureNodeMeetsEngines,
  MIN_NODE_MAJOR,
  readEnginesNodeRequirement,
  unsupportedNodeMessage,
} from "../src/bin.js";

const binPath = resolve(process.cwd(), "dist/src/bin.js");
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
  engines: { node: string };
  version: string;
};

function run(
  execPath: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(execPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: env ?? process.env,
      shell: process.platform === "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (exit) => resolvePromise({ code: exit ?? 1, stdout, stderr }));
  });
}

function findOldNodeBinary(): string | undefined {
  const candidates = [
    process.env.EBB_OLD_NODE,
    `${process.env.HOME}/.nvm/versions/node/v18.20.4/bin/node`,
    `${process.env.HOME}/.nvm/versions/node/v18.20.2/bin/node`,
    `${process.env.HOME}/.fnm/node-versions/v18.20.4/installation/bin/node`,
  ].filter((p): p is string => Boolean(p));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

describe("bin Node engine gate", () => {
  it("does not lower engines.node and rejects versions below the minimum", () => {
    assert.equal(pkg.engines.node, `>=${MIN_NODE_MAJOR}`);
    assert.equal(readEnginesNodeRequirement(), pkg.engines.node);

    const rejected = ensureNodeMeetsEngines("v18.20.0");
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.message, unsupportedNodeMessage(pkg.engines.node, "v18.20.0"));
      assert.match(rejected.message, /ebb requires Node\.js >=22/);
      assert.match(rejected.message, /v18\.20\.0/);
    }

    const accepted = ensureNodeMeetsEngines(`v${MIN_NODE_MAJOR}.0.0`);
    assert.equal(accepted.ok, true);
  });

  it("runs ebb mcp through the bin entry with empty stderr on supported Node", async () => {
    const { code, stdout, stderr } = await run(process.execPath, [binPath, "mcp", "--self-test"]);
    assert.equal(code, 0);
    assert.equal(stderr, "");
    assert.match(stdout, /ebb mcp self-test ok/);
  });

  it("runs another command through the bin entry", async () => {
    const { code, stdout, stderr } = await run(process.execPath, [binPath, "--version"]);
    assert.equal(code, 0);
    assert.equal(stderr, "");
    assert.equal(stdout, `ebb ${pkg.version}\n`);
  });

  it("with an old Node binary, rejects mcp and another command with exit 1, empty stdout, exact stderr", async () => {
    const localOld = findOldNodeBinary();
    const runner = localOld
      ? { exec: localOld, prefix: [] as string[] }
      : { exec: process.platform === "win32" ? "npx.cmd" : "npx", prefix: ["-y", "node@18.20.4"] };

    const versionResult = await run(runner.exec, [...runner.prefix, "-p", "process.version"]);
    assert.equal(versionResult.code, 0, `failed to probe old Node: ${versionResult.stderr}`);
    const oldVersion = versionResult.stdout.trim();
    assert.match(oldVersion, /^v1[68]\./);
    const expected = unsupportedNodeMessage(pkg.engines.node, oldVersion);

    for (const commandArgs of [["mcp", "--self-test"], ["--version"]]) {
      const { code, stdout, stderr } = await run(runner.exec, [...runner.prefix, binPath, ...commandArgs]);
      assert.equal(code, 1, `expected exit 1 for ${commandArgs.join(" ")}; stderr=${stderr}`);
      assert.equal(stdout, "", `stdout must stay empty; got ${JSON.stringify(stdout)}`);
      assert.equal(stderr, expected);
    }
  });
});
