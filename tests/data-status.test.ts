import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { runCli } from "../src/cli.js";
import { buildDataBundle } from "../src/data-bundle.js";
import { configureActiveData, getActiveDataSync } from "../src/data-source.js";
import { dataStatus } from "../src/data-status.js";
import { addDays } from "../src/upcoming.js";

function createMockIo() {
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

  return {
    io: { stdout, stderr },
    get stdout() {
      return stdoutData;
    },
    get stderr() {
      return stderrData;
    },
  };
}

describe("offline-8: warn when active data is old", () => {
  it("dataStatus includes warning when active data is older than stale limit", () => {
    const reviewedThrough = getActiveDataSync().info.reviewedThrough;
    const statusFresh = dataStatus({ now: addDays(reviewedThrough, 5) });
    assert.equal(statusFresh.stale, false);
    assert.equal(
      statusFresh.warnings.some((w) => w.includes("freshness threshold")),
      false,
    );

    const statusOld = dataStatus({ now: addDays(reviewedThrough, 50) });
    assert.equal(statusOld.stale, true);
    assert.ok(statusOld.warnings.some((w) => w.includes("freshness threshold")));
  });

  it("CLI prints no warning on stderr when data is fresh", async () => {
    const prevAge = process.env.EBB_DATA_MAX_AGE_DAYS;
    try {
      // Set high freshness window to ensure data is considered fresh
      process.env.EBB_DATA_MAX_AGE_DAYS = "99999";
      const mock = createMockIo();
      const code = await runCli(["check", "pkg:npm/express@4.18.2"], mock.io);
      assert.equal(code, 0);
      assert.equal(mock.stderr, "");
      assert.ok(mock.stdout.includes("pkg:npm/express@4.18.2"));
    } finally {
      if (prevAge === undefined) delete process.env.EBB_DATA_MAX_AGE_DAYS;
      else process.env.EBB_DATA_MAX_AGE_DAYS = prevAge;
    }
  });

  it("CLI prints warning on stderr once when data is old, keeping stdout and exit code unchanged", async (t) => {
    const prevAge = process.env.EBB_DATA_MAX_AGE_DAYS;
    try {
      // Set 0 days max age to force stale status
      process.env.EBB_DATA_MAX_AGE_DAYS = "0";

      const tomorrow = addDays(getActiveDataSync().info.reviewedThrough, 1);
      t.mock.timers.enable({ apis: ["Date"], now: new Date(tomorrow) });

      // 1. Passing check with old data
      const mock1 = createMockIo();
      const code1 = await runCli(["check", "pkg:npm/express@4.18.2", "--json"], mock1.io);
      assert.equal(code1, 0, "must not block or fail check because data is old");
      assert.match(mock1.stderr, /Warning: Data is \d+ days old/);
      assert.match(mock1.stderr, /Run 'ebb update' to refresh/);
      const parsed1 = JSON.parse(mock1.stdout);
      assert.equal(parsed1.status, "ok");

      // 2. Deprecated package check with old data
      const mock2 = createMockIo();
      const code2 = await runCli(["check", "pkg:npm/request@2.88.2", "--json"], mock2.io);
      assert.equal(code2, 1, "exit code must reflect check verdict, not data age");
      assert.match(mock2.stderr, /Warning: Data is \d+ days old/);
      const parsed2 = JSON.parse(mock2.stdout);
      assert.equal(parsed2.status, "deprecated");
    } finally {
      if (prevAge === undefined) delete process.env.EBB_DATA_MAX_AGE_DAYS;
      else process.env.EBB_DATA_MAX_AGE_DAYS = prevAge;
    }
  });

  it("CLI silences warning on stderr when --quiet (-q) is passed", async () => {
    const prevAge = process.env.EBB_DATA_MAX_AGE_DAYS;
    try {
      process.env.EBB_DATA_MAX_AGE_DAYS = "0";

      // Test with --quiet
      const mock1 = createMockIo();
      const code1 = await runCli(["check", "pkg:npm/express@4.18.2", "--quiet", "--json"], mock1.io);
      assert.equal(code1, 0);
      assert.equal(mock1.stderr, "");
      const parsed1 = JSON.parse(mock1.stdout);
      assert.equal(parsed1.status, "ok");

      // Test with -q
      const mock2 = createMockIo();
      const code2 = await runCli(["check", "pkg:npm/express@4.18.2", "-q", "--json"], mock2.io);
      assert.equal(code2, 0);
      assert.equal(mock2.stderr, "");
      const parsed2 = JSON.parse(mock2.stdout);
      assert.equal(parsed2.status, "ok");
    } finally {
      if (prevAge === undefined) delete process.env.EBB_DATA_MAX_AGE_DAYS;
      else process.env.EBB_DATA_MAX_AGE_DAYS = prevAge;
    }
  });

  describe("cache-10: show cache state in ebb data-status", () => {
    it("reports package origin when using bundled data", () => {
      const status = dataStatus();
      assert.equal(status.schemaVersion, "ebb.data-status.v1", "schemaVersion must not be bumped");
      assert.equal(status.origin, "package");
      assert.equal(status.hasRollback, false);
      assert.equal(status.rollbackVersion, null);
      assert.ok(typeof status.cachePath === "string");
    });

    it("reports cache origin, cachePath, and rollback info when cache is active", async () => {
      const createdAt = `${addDays(getActiveDataSync().info.reviewedThrough, 1)}T00:00:00Z`;
      const tmp = await mkdtemp(join(tmpdir(), "ebb-status-cache-test-"));
      const oldDir = process.env.EBB_DATA_DIR;
      process.env.EBB_DATA_DIR = tmp;
      configureActiveData({
        verifySignature: () => ({ identity: "ci@example.com", issuer: "https://token.actions.githubusercontent.com" }),
      });
      try {
        const bundle = await buildDataBundle({
          root: resolve("."),
          createdAt,
          minimumEbbVersion: "0.2.0",
          ecosystem: "npm",
        });
        const version = bundle.manifest.version;
        const versionDir = join(tmp, "data", version);
        await mkdir(versionDir, { recursive: true });
        await writeFile(join(tmp, "data", "active.json"), JSON.stringify({ version }) + "\n");
        await writeFile(join(tmp, "data", "previous.json"), JSON.stringify({ version: "2026.10.01" }) + "\n");
        await writeFile(join(versionDir, "bundle.json"), JSON.stringify(bundle));
        await writeFile(join(versionDir, "bundle.json.sigstore.json"), "{}");

        const status = dataStatus();
        assert.equal(status.schemaVersion, "ebb.data-status.v1");
        assert.equal(status.origin, "cache");
        assert.equal(status.hasRollback, true);
        assert.equal(status.rollbackVersion, "2026.10.01");
        assert.equal(status.cachePath, tmp);

        // CLI text output
        const mockText = createMockIo();
        const codeText = await runCli(["data-status"], mockText.io);
        assert.equal(codeText, 0);
        assert.match(mockText.stdout, /Origin:\s+cache/);
        assert.match(mockText.stdout, /Rollback copy:\s+yes \(2026\.10\.01\)/);

        // CLI JSON output
        const mockJson = createMockIo();
        const codeJson = await runCli(["data-status", "--json"], mockJson.io);
        assert.equal(codeJson, 0);
        const parsed = JSON.parse(mockJson.stdout);
        assert.equal(parsed.origin, "cache");
        assert.equal(parsed.hasRollback, true);
        assert.equal(parsed.rollbackVersion, "2026.10.01");
      } finally {
        configureActiveData({});
        if (oldDir !== undefined) process.env.EBB_DATA_DIR = oldDir;
        else delete process.env.EBB_DATA_DIR;
        await rm(tmp, { recursive: true, force: true });
      }
    });
  });
});
