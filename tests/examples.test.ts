import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const repoRoot = resolve(process.cwd());
const cliBin = resolve(repoRoot, "dist/src/cli.js");

function runNodeScript(scriptRelativePath: string, args: string[] = []): string {
  const fullPath = resolve(repoRoot, scriptRelativePath);
  return execFileSync(process.execPath, ["--experimental-strip-types", fullPath, ...args], {
    encoding: "utf-8",
    cwd: repoRoot,
  });
}

describe("Examples Suite (Epic 18)", () => {
  describe("examples/package-json", () => {
    it("runs check.ts and detects deprecated dependencies", () => {
      const stdout = runNodeScript("examples/package-json/check.ts");
      assert.ok(stdout.includes("Scanned 4 dependencies"));
      assert.ok(stdout.includes("pkg:npm/left-pad@1.3.0 -> deprecated"));
      assert.ok(stdout.includes("pkg:npm/request@2.88.2 -> deprecated"));
      assert.ok(stdout.includes("pkg:npm/node-sass@9.0.0 -> end-of-life"));
      assert.ok(stdout.includes("String.prototype.padStart()"));
    });
  });

  describe("examples/cyclonedx", () => {
    it("runs check-sbom.ts and detects components in CycloneDX format", () => {
      const stdout = runNodeScript("examples/cyclonedx/check-sbom.ts");
      assert.ok(stdout.includes("Format: CycloneDX v1.5"));
      assert.ok(stdout.includes("Components evaluated: 4"));
      assert.ok(stdout.includes("left-pad (pkg:npm/left-pad@1.3.0) -> DEPRECATED"));
      assert.ok(stdout.includes("request (pkg:npm/request@2.88.2) -> DEPRECATED"));
      assert.ok(stdout.includes("django (pkg:pypi/django@2.2.0) -> END-OF-LIFE"));
    });

    it("evaluates CycloneDX SBOM directly via Ebb CLI check-all", () => {
      const bomPath = resolve(repoRoot, "examples/cyclonedx/bom.json");
      let stdout = "";
      try {
        stdout = execFileSync(process.execPath, [cliBin, "check-all", bomPath, "--json"], { encoding: "utf-8" });
      } catch (err: unknown) {
        // CLI exits with status 1 when findings are present, stdout still contains JSON
        const execErr = err as { stdout?: string; status?: number };
        stdout = execErr.stdout ?? "";
        assert.equal(execErr.status, 1);
      }

      assert.ok(stdout.includes("left-pad"));
      assert.ok(stdout.includes("request"));
      const parsed = JSON.parse(stdout) as { summary: { total: number } };
      assert.equal(parsed.summary.total, 4);
    });
  });

  describe("examples/dockerfile", () => {
    it("runs check-dockerfile.ts and detects end-of-life base images", () => {
      const stdout = runNodeScript("examples/dockerfile/check-dockerfile.ts");
      assert.ok(stdout.includes("Evaluated 2 base image instruction(s)"));
      assert.ok(stdout.includes("node:16-alpine -> end-of-life"));
      assert.ok(stdout.includes("python:3.7-slim -> end-of-life"));
      assert.ok(stdout.includes("node:22"));
    });
  });

  describe("examples/github-actions", () => {
    it("runs check-workflow.ts and detects unsupported workflow actions", () => {
      const stdout = runNodeScript("examples/github-actions/check-workflow.ts");
      assert.ok(stdout.includes("Evaluated 3 action reference(s)"));
      assert.ok(stdout.includes("actions/checkout@v2 -> unsupported"));
      assert.ok(stdout.includes("actions/setup-node@v1 -> unsupported"));
      assert.ok(stdout.includes("actions/checkout@v5 -> ok"));
      assert.ok(stdout.includes("actions/checkout@v5 or later"));
    });
  });

  describe("examples/upcoming-eol", () => {
    it("runs upcoming-eol.ts and forecasts lifecycle deadlines", () => {
      const stdout = runNodeScript("examples/upcoming-eol/upcoming-eol.ts", ["--as-of=2026-01-01", "--days=180"]);
      assert.ok(stdout.includes("Django Web Framework (pkg:pypi/django@4.2)"));
      assert.ok(stdout.includes("96 days remaining"));
      assert.ok(stdout.includes("Node.js Runtime (node@20.0.0)"));
      assert.ok(stdout.includes("119 days remaining"));
      assert.ok(stdout.includes("Ubuntu Base Image (pkg:docker/library/ubuntu@20.04) -> END-OF-LIFE"));
    });
  });

  describe("examples/static-api", () => {
    it("runs fetch-rule.ts with modern fetch helper", () => {
      const stdout = runNodeScript("examples/static-api/fetch-rule.ts", ["pkg:npm/left-pad"]);
      assert.ok(stdout.includes("Mapped API Path: npm/left-pad.json"));
      assert.ok(stdout.includes("Component: left-pad (type: npm)"));
      assert.ok(stdout.includes("String.prototype.padStart()"));
    });

    it("runs check.sh shell script successfully", () => {
      const scriptPath = resolve(repoRoot, "examples/static-api/check.sh");
      const stdout = execFileSync("bash", [scriptPath, "pkg:npm/left-pad"], {
        encoding: "utf-8",
        cwd: repoRoot,
      });

      assert.ok(stdout.includes("Querying Ebb Static API for: pkg:npm/left-pad"));
      assert.ok(stdout.includes("String.prototype.padStart()"));
    });
  });

  describe("runtime and platform examples structure", () => {
    it("verifies all example directories and documentation files exist", () => {
      const expectedPaths = [
        "examples/package-json/README.md",
        "examples/cyclonedx/README.md",
        "examples/dockerfile/README.md",
        "examples/github-actions/README.md",
        "examples/upcoming-eol/README.md",
        "examples/static-api/README.md",
        "examples/browser/README.md",
        "examples/browser/index.html",
        "examples/workers/cloudflare/src/index.ts",
        "examples/workers/vercel/api/check.ts",
        "examples/deno/README.md",
        "examples/bun/README.md",
      ];

      for (const rel of expectedPaths) {
        assert.ok(existsSync(resolve(repoRoot, rel)), `Missing example file: ${rel}`);
      }
    });
  });
});
