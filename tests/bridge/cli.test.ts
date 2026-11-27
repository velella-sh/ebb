import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { runCli } from "../../src/cli.js";

const REPO_ROOT = resolve(process.cwd());
const TRIVY_FIXTURE = join(REPO_ROOT, "tests", "fixtures", "trivy", "image-report.json");
const GRYPE_FIXTURE = join(REPO_ROOT, "tests", "fixtures", "grype", "image-report.json");

function createMockIo(stdinData = ""): {
  stdout: { str: string; write(s: string): boolean };
  stderr: { str: string; write(s: string): boolean };
  stdin: AsyncIterable<Buffer>;
} {
  const stdout = {
    str: "",
    write(s: string) {
      this.str += s;
      return true;
    },
  };
  const stderr = {
    str: "",
    write(s: string) {
      this.str += s;
      return true;
    },
  };
  const stdin = (async function* () {
    if (stdinData) yield Buffer.from(stdinData);
  })();

  return { stdout, stderr, stdin };
}

test("ebb bridge trivy outputs Markdown table and respects --fail-on", async () => {
  const io = createMockIo();
  const code = await runCli(["bridge", "trivy", TRIVY_FIXTURE, "--fail-on", "end-of-life"], io);
  assert.equal(code, 1, "Should fail with code 1 on end-of-life finding");
  assert.match(io.stdout.str, /### Ebb Lifecycle Bridge Summary \(trivy\)/);
  assert.match(io.stdout.str, /os:alpine/);
  assert.match(io.stdout.str, /❌ end-of-life/);
});

test("ebb bridge trivy with --fail-on none exits 0", async () => {
  const io = createMockIo();
  const code = await runCli(["bridge", "trivy", TRIVY_FIXTURE, "--fail-on", "none"], io);
  assert.equal(code, 0);
});

test("ebb bridge trivy with --format json outputs machine-readable JSON", async () => {
  const io = createMockIo();
  const code = await runCli(["bridge", "trivy", TRIVY_FIXTURE, "--format", "json", "--fail-on", "none"], io);
  assert.equal(code, 0);
  const parsed = JSON.parse(io.stdout.str);
  assert.equal(parsed.scanner, "trivy");
  assert.equal(parsed.counts.endOfLife, 1);
  assert.ok(Array.isArray(parsed.lifecycle));
});

test("ebb bridge grype outputs Markdown table and warning", async () => {
  const io = createMockIo();
  const code = await runCli(["bridge", "grype", GRYPE_FIXTURE, "--fail-on", "none"], io);
  assert.equal(code, 0);
  assert.match(io.stdout.str, /### Ebb Lifecycle Bridge Summary \(grype\)/);
  assert.match(io.stdout.str, /Grype reports list only vulnerable artifacts/);
});

test("ebb bridge rejects invalid scanner with exit code 2", async () => {
  const io = createMockIo();
  const code = await runCli(["bridge", "invalid-scanner", TRIVY_FIXTURE], io);
  assert.equal(code, 2);
  assert.match(io.stderr.str, /Expected scanner name: trivy or grype/);
});

test("ebb bridge works from npm pack tarball in a clean project on both recorded reports", async () => {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const tempRoot = await mkdtemp(join(tmpdir(), "ebb-bridge-pack-test-"));

  try {
    const packStdout = execFileSync(npmCmd, ["pack", "--silent", "--ignore-scripts", "--pack-destination", tempRoot], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
    const tarballName = packStdout.split(/\r?\n/).filter(Boolean).at(-1);
    assert.ok(tarballName, `expected npm pack output, got: "${packStdout}"`);
    const tarballPath = join(tempRoot, tarballName);

    const appDir = join(tempRoot, "app");
    await mkdir(appDir, { recursive: true });
    await writeFile(
      join(appDir, "package.json"),
      JSON.stringify({ name: "ebb-bridge-consumer", version: "1.0.0", private: true, type: "module" }, null, 2),
      "utf8",
    );

    execFileSync(npmCmd, ["install", "--prefer-offline", "--no-audit", "--no-fund", tarballPath], {
      cwd: appDir,
      stdio: "pipe",
    });

    const cliPath = join(appDir, "node_modules", "@velella", "ebb", "dist", "src", "bin.js");

    // Execute on Trivy report
    const trivyOut = execFileSync("node", [cliPath, "bridge", "trivy", TRIVY_FIXTURE, "--fail-on", "none"], {
      cwd: appDir,
      encoding: "utf8",
    });
    assert.match(trivyOut, /### Ebb Lifecycle Bridge Summary \(trivy\)/);
    assert.match(trivyOut, /os:alpine/);
    assert.match(trivyOut, /❌ end-of-life/);

    // Execute on Grype report
    const grypeOut = execFileSync("node", [cliPath, "bridge", "grype", GRYPE_FIXTURE, "--fail-on", "none"], {
      cwd: appDir,
      encoding: "utf8",
    });
    assert.match(grypeOut, /### Ebb Lifecycle Bridge Summary \(grype\)/);
    assert.match(grypeOut, /os:alpine/);
    assert.match(grypeOut, /❌ end-of-life/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
