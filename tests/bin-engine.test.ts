import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
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
    const child = spawn(process.execPath, [binPath, "mcp", "--self-test"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    const code = await new Promise<number>((resolvePromise, reject) => {
      child.on("error", reject);
      child.on("close", (exit) => resolvePromise(exit ?? 1));
    });
    assert.equal(code, 0);
    assert.equal(stderr, "");
    assert.match(stdout, /ebb mcp self-test ok/);
  });

  it("runs another command through the bin entry", async () => {
    const child = spawn(process.execPath, [binPath, "--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    const code = await new Promise<number>((resolvePromise, reject) => {
      child.on("error", reject);
      child.on("close", (exit) => resolvePromise(exit ?? 1));
    });
    assert.equal(code, 0);
    assert.equal(stderr, "");
    assert.equal(stdout, `ebb ${pkg.version}\n`);
  });

  it("prints the unsupported-node message on stderr with empty stdout and exit 1", async () => {
    const script = `
      import { pathToFileURL } from "node:url";
      import { ensureNodeMeetsEngines } from ${JSON.stringify(pathToFileURL(binPath).href)};
      const gate = ensureNodeMeetsEngines("v16.20.2");
      if (gate.ok) {
        process.stderr.write("expected failure\\n");
        process.exit(2);
      }
      process.stderr.write(gate.message);
      process.exit(1);
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    const code = await new Promise<number>((resolvePromise, reject) => {
      child.on("error", reject);
      child.on("close", (exit) => resolvePromise(exit ?? 0));
    });
    assert.equal(code, 1);
    assert.equal(stdout, "");
    assert.equal(stderr, unsupportedNodeMessage(pkg.engines.node, "v16.20.2"));
  });
});
