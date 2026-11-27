import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const REPO_ROOT = resolve(process.cwd());
const FIXTURES_DIR = join(REPO_ROOT, "tests", "fixtures", "trivy");

test("Trivy plugin manifest adheres to recorded plugin format", () => {
  const manifestContent = readFileSync(join(REPO_ROOT, "integrations", "trivy", "plugin.yaml"), "utf8");
  assert.match(manifestContent, /name:\s*"ebb"/);
  assert.match(manifestContent, /version:\s*"0\.2\.1"/);
  assert.match(manifestContent, /usage:\s*"trivy ebb/);
  assert.match(manifestContent, /bin:\s*ebb\.sh/);
  assert.match(manifestContent, /os:\s*linux/);
  assert.match(manifestContent, /os:\s*darwin/);
});

test("Trivy plugin wrapper runs mock trivy and pipes into ebb bridge", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "trivy-plugin-test-"));
  try {
    const mockTrivy = join(tempDir, "trivy");
    const reportPath = join(FIXTURES_DIR, "image-report.json");
    const argsLog = join(tempDir, "args.log");

    // Write mock trivy script
    const script = `#!/bin/sh
echo "$@" >> "${argsLog}"
cat "${reportPath}"
`;
    writeFileSync(mockTrivy, script, "utf8");
    chmodSync(mockTrivy, 0o755);

    const pluginScript = join(REPO_ROOT, "integrations", "trivy", "ebb.sh");
    const binScript = join(REPO_ROOT, "dist", "src", "bin.js");

    const env = {
      ...process.env,
      PATH: `${tempDir}:${process.env.PATH}`,
      EBB_BIN: `node ${binScript}`,
    };

    const stdout = execFileSync(pluginScript, ["image", "alpine:3.14"], {
      env,
      encoding: "utf8",
    });

    // Verify mock trivy received expected arguments
    const loggedArgs = readFileSync(argsLog, "utf8");
    assert.match(loggedArgs, /image alpine:3\.14 --format json --list-all-pkgs/);

    // Verify bridge output contains summary and alpine EOL finding
    assert.match(stdout, /### Ebb Lifecycle Bridge Summary \(trivy\)/);
    assert.match(stdout, /os:alpine/);
    assert.match(stdout, /❌ end-of-life/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
