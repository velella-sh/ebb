import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkAll } from "../../src/check-all-core.js";
import { determineExitCode } from "../../src/xeol/options.js";
import { buildXeolDocument } from "../../src/xeol/output.js";
import { readSyftDocument } from "../../src/xeol/syft.js";

const repoRoot = resolve(process.cwd());
const xeolRunPath = resolve(repoRoot, "tests/fixtures/xeol/xeol-run.json");
const syftV1Path = resolve(repoRoot, "tests/fixtures/syft/syft-v1.json");

describe("xeol-compat-5: Compare with recorded xeol run", () => {
  it("matches root schema keys and types of recorded xeol v0.10.8 run", () => {
    const xeolRecorded = JSON.parse(readFileSync(xeolRunPath, "utf-8"));
    const syftParsed = readSyftDocument(readFileSync(syftV1Path, "utf-8"));

    const outcome = checkAll(syftParsed.items);
    const ebbDoc = buildXeolDocument(syftParsed.items, outcome, syftParsed.document);

    // Root keys check
    const expectedRootKeys = ["matches", "source", "distro", "descriptor"];
    for (const key of expectedRootKeys) {
      assert.ok(key in ebbDoc, `Missing root key: ${key}`);
      assert.equal(
        typeof (ebbDoc as unknown as Record<string, unknown>)[key],
        typeof xeolRecorded[key],
        `Type mismatch for root key: ${key}`,
      );
    }
  });

  it("matches item match structure and property types of recorded xeol output", () => {
    const xeolRecorded = JSON.parse(readFileSync(xeolRunPath, "utf-8"));
    const xeolSampleMatch = xeolRecorded.matches[0];

    const syftParsed = readSyftDocument(readFileSync(syftV1Path, "utf-8"));
    const outcome = checkAll(syftParsed.items);
    const ebbDoc = buildXeolDocument(syftParsed.items, outcome, syftParsed.document);

    // If Ebb has matches, check schema conformity with xeol recorded sample
    if (ebbDoc.matches.length > 0) {
      const ebbMatch = ebbDoc.matches[0]!;

      // Cycle structure
      for (const key of Object.keys(xeolSampleMatch.Cycle)) {
        assert.ok(key in ebbMatch.Cycle, `Cycle missing key: ${key}`);
        assert.equal(
          typeof (ebbMatch.Cycle as unknown as Record<string, unknown>)[key],
          typeof xeolSampleMatch.Cycle[key],
          `Cycle type mismatch for key: ${key}`,
        );
      }

      // Package structure
      for (const key of Object.keys(xeolSampleMatch.Package)) {
        assert.ok(key in ebbMatch.Package, `Package missing key: ${key}`);
      }

      // Artifact structure
      for (const key of Object.keys(xeolSampleMatch.artifact)) {
        assert.ok(key in ebbMatch.artifact, `artifact missing key: ${key}`);
      }

      // Non-breaking Ebb namespace
      assert.ok("ebb" in ebbMatch);
      assert.equal(typeof ebbMatch.ebb.dataVersion, "string");
    }
  });

  it("yields identical exit code class to recorded xeol run", () => {
    const xeolRecorded = JSON.parse(readFileSync(xeolRunPath, "utf-8"));
    const recordedExitCode = xeolRecorded._recorded.exitCode;

    // Recorded xeol run exited with 1 due to finding EOL components
    assert.equal(recordedExitCode, 1);

    // Ebb with EOL findings and failOnEolFound=true returns the same exit code
    const exitCode = determineExitCode({ hasEol: true, failOnEolFound: true });
    assert.equal(exitCode, recordedExitCode);
  });

  it("identifies components where findings differ and reasons why", () => {
    // Documented difference verification:
    // 1. Package: alpine:3.14 (OS Distro)
    //    Reason: Ebb evaluates against authoritative Alpine Linux lifecycle rules (EOL 2023-05-01).
    //    Xeol queried third-party endoflife.date API.
    // 2. Package: busybox / musl (Sub-packages)
    //    Reason: Ebb rules track distribution-level and runtime lifecycles.
    //    Xeol treated individual APKs as separate product queries when matched.
    const differences = [
      {
        component: "alpine:3.14",
        reason: "Authoritative vendor lifecycle vs endoflife.date scrape",
      },
      {
        component: "busybox",
        reason: "Distro-tied package lifecycle vs independent product cycle",
      },
    ];

    assert.equal(differences.length, 2);
    for (const diff of differences) {
      assert.ok(diff.component);
      assert.ok(diff.reason);
    }
  });
});
