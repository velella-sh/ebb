import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const REPO_ROOT = resolve(process.cwd());
const TRIVY_FIXTURES = join(REPO_ROOT, "tests", "fixtures", "trivy");
const GRYPE_FIXTURES = join(REPO_ROOT, "tests", "fixtures", "grype");

test("scan-trivy.sh runs mock trivy and produces lifecycle table", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "scan-trivy-test-"));
  try {
    const mockTrivy = join(tempDir, "trivy");
    const reportPath = join(TRIVY_FIXTURES, "image-report.json");

    writeFileSync(mockTrivy, `#!/bin/sh\ncat "${reportPath}"\n`, "utf8");
    chmodSync(mockTrivy, 0o755);

    const script = join(REPO_ROOT, "examples", "scanners", "scan-trivy.sh");
    const binScript = join(REPO_ROOT, "dist", "src", "bin.js");

    const stdout = execFileSync(script, ["alpine:3.14"], {
      env: {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH}`,
        EBB_BIN: `node ${binScript}`,
      },
      encoding: "utf8",
    });

    assert.match(stdout, /### Ebb Lifecycle Bridge Summary \(trivy\)/);
    assert.match(stdout, /❌ end-of-life/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("scan-grype.sh runs mock grype and produces lifecycle table", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "scan-grype-test-"));
  try {
    const mockGrype = join(tempDir, "grype");
    const reportPath = join(GRYPE_FIXTURES, "image-report.json");

    writeFileSync(mockGrype, `#!/bin/sh\ncat "${reportPath}"\n`, "utf8");
    chmodSync(mockGrype, 0o755);

    const script = join(REPO_ROOT, "examples", "scanners", "scan-grype.sh");
    const binScript = join(REPO_ROOT, "dist", "src", "bin.js");

    const stdout = execFileSync(script, ["alpine:3.14"], {
      env: {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH}`,
        EBB_BIN: `node ${binScript}`,
      },
      encoding: "utf8",
    });

    assert.match(stdout, /### Ebb Lifecycle Bridge Summary \(grype\)/);
    assert.match(stdout, /❌ end-of-life/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
