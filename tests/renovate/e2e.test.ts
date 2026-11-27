import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("renovate end-to-end execution on fixture repo with custom datasource", async (t) => {
  if (!process.env.RENOVATE_E2E && !process.env.CI) {
    t.skip("Set RENOVATE_E2E=1 or CI=true to run end-to-end Renovate CLI test");
    return;
  }
  const fixtureSrc = join(process.cwd(), "tests/renovate/fixture-repo");
  const tempDir = await mkdtemp(join(tmpdir(), "ebb-renovate-e2e-"));

  try {
    await cp(fixtureSrc, tempDir, { recursive: true });

    // Initialize clean git repository
    await execFileAsync("git", ["init", "-b", "main"], { cwd: tempDir });
    await execFileAsync("git", ["config", "user.name", "E2E Tester"], { cwd: tempDir });
    await execFileAsync("git", ["config", "user.email", "test@velella.sh"], { cwd: tempDir });
    await execFileAsync("git", ["add", "."], { cwd: tempDir });
    await execFileAsync("git", ["commit", "-m", "chore: fixture init"], { cwd: tempDir });

    // Run Renovate in lookup dry-run mode
    let runOutput: string;
    try {
      const res = await execFileAsync(
        "npx",
        ["--package=renovate@42.99.0", "renovate", "--platform=local", "--dry-run=lookup"],
        {
          cwd: tempDir,
          env: { ...process.env, LOG_LEVEL: "debug" },
        },
      );
      runOutput = `${res.stdout}\n${res.stderr}`;
    } catch (err: unknown) {
      const stdout = (err as { stdout?: string }).stdout ?? "";
      const stderr = (err as { stderr?: string }).stderr ?? "";
      runOutput = `${stdout}\n${stderr}`;
    }

    assert.match(
      runOutput,
      /renovate\/node-/,
      "Renovate must observe end-of-life Node.js 18 and plan branch for upgrade",
    );

    // Now empty the feed and assert zero updates
    await writeFile(join(tempDir, "node.json"), JSON.stringify({ releases: [] }), "utf8");
    await execFileAsync("git", ["add", "node.json"], { cwd: tempDir });
    await execFileAsync("git", ["commit", "-m", "chore: empty feed"], { cwd: tempDir });

    let emptyOutput: string;
    try {
      const res = await execFileAsync(
        "npx",
        ["--package=renovate@42.99.0", "renovate", "--platform=local", "--dry-run=lookup"],
        {
          cwd: tempDir,
          env: { ...process.env, LOG_LEVEL: "debug" },
        },
      );
      emptyOutput = `${res.stdout}\n${res.stderr}`;
    } catch (err: unknown) {
      const stdout = (err as { stdout?: string }).stdout ?? "";
      const stderr = (err as { stderr?: string }).stderr ?? "";
      emptyOutput = `${stdout}\n${stderr}`;
    }

    assert.match(emptyOutput, /0 flattened updates found/, "Renovate must report zero updates when feed is empty");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
