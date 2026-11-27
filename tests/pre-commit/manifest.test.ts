import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import yaml from "yaml";

interface PreCommitHook {
  id: string;
  name: string;
  description?: string;
  entry: string;
  language: string;
  files: string;
  types?: string[];
  args?: string[];
  additional_dependencies?: string[];
}

interface PreCommitConfig {
  repos: Array<{
    repo: string;
    rev: string;
    hooks: Array<{
      id: string;
      args?: string[];
    }>;
  }>;
}

function toJsRegExp(pythonRegex: string): RegExp {
  const flags = pythonRegex.startsWith("(?i)") ? "i" : "";
  const cleaned = pythonRegex.replace(/^\(\?i\)/, "");
  return new RegExp(cleaned, flags);
}

describe("Pre-commit Manifest (.pre-commit-hooks.yaml)", () => {
  const manifestPath = resolve(process.cwd(), ".pre-commit-hooks.yaml");
  const manifestRaw = readFileSync(manifestPath, "utf8");
  const hooks = yaml.parse(manifestRaw) as PreCommitHook[];

  it("manifest exists and contains valid array of hooks", () => {
    assert.ok(Array.isArray(hooks), "Manifest should be an array");
    assert.equal(hooks.length, 2, "Manifest should define exactly 2 hooks");
  });

  it("defines ebb-sbom hook with valid keys and patterns", () => {
    const hook = hooks.find((h) => h.id === "ebb-sbom");
    assert.ok(hook, "ebb-sbom hook must exist");
    assert.equal(hook.language, "node");
    assert.equal(hook.entry, "ebb check-all");
    assert.ok(Array.isArray(hook.args));
    assert.ok(hook.args.includes("--fail-on"));
    assert.ok(hook.args.includes("end-of-life"));
    assert.ok(Array.isArray(hook.types));
    assert.ok(hook.types.includes("json"));

    const regex = toJsRegExp(hook.files);
    assert.ok(regex.test("sbom.json"));
    assert.ok(regex.test("bom.json"));
    assert.ok(regex.test("project-cyclonedx.json"));
    assert.ok(regex.test("app.spdx.json"));
    assert.ok(regex.test("syft.json"));
    assert.ok(regex.test("dist/sbom-pass.json"));

    // Manifests and lockfiles should not match
    assert.equal(regex.test("package.json"), false);
    assert.equal(regex.test("package-lock.json"), false);
    assert.equal(regex.test("cargo.lock"), false);
  });

  it("defines ebb-purls hook with valid keys and patterns", () => {
    const hook = hooks.find((h) => h.id === "ebb-purls");
    assert.ok(hook, "ebb-purls hook must exist");
    assert.equal(hook.language, "node");
    assert.equal(hook.entry, "ebb check-all");
    assert.ok(Array.isArray(hook.args));
    assert.ok(hook.args.includes("--fail-on"));
    assert.ok(hook.args.includes("end-of-life"));
    assert.ok(Array.isArray(hook.types));
    assert.ok(hook.types.includes("text"));

    const regex = toJsRegExp(hook.files);
    assert.ok(regex.test(".ebb-purls"));
    assert.ok(regex.test("subproject/.ebb-purls"));
    assert.equal(regex.test("purls.txt"), false);
    assert.equal(regex.test("package.json"), false);
  });

  it("provides additional_dependencies for zero-build-step execution", () => {
    for (const hook of hooks) {
      assert.ok(Array.isArray(hook.additional_dependencies));
      assert.ok(
        hook.additional_dependencies.some((dep) => dep.startsWith("@velella/ebb")),
        `Hook ${hook.id} must include @velella/ebb in additional_dependencies`,
      );
    }
  });

  it("example configuration in examples/pre-commit/.pre-commit-config.yaml validates", () => {
    const exampleConfigPath = resolve(process.cwd(), "examples/pre-commit/.pre-commit-config.yaml");
    const exampleRaw = readFileSync(exampleConfigPath, "utf8");
    const config = yaml.parse(exampleRaw) as PreCommitConfig;

    assert.ok(Array.isArray(config.repos), "Example should have repos list");
    const ebbRepo = config.repos.find((r) => r.repo.includes("velella-sh/ebb"));
    assert.ok(ebbRepo, "Example should point to velella-sh/ebb repo");
    assert.ok(ebbRepo.rev, "Example must specify a rev");
    assert.notEqual(ebbRepo.rev, "main", "rev must be pinned, not moving (main)");
    assert.notEqual(ebbRepo.rev, "master", "rev must be pinned, not moving (master)");
    assert.notEqual(ebbRepo.rev, "HEAD", "rev must be pinned, not moving (HEAD)");

    const hookIds = ebbRepo.hooks.map((h) => h.id);
    assert.ok(hookIds.includes("ebb-sbom"), "Example must configure ebb-sbom");
    assert.ok(hookIds.includes("ebb-purls"), "Example must configure ebb-purls");
  });
});
