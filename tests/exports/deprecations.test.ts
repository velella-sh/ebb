import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const DEPRECATION_CODES = new Set([6385, 6387]);

const LEGACY_MAIN_EXPORTS: ReadonlyArray<readonly [subpath: string, symbol: string, isType?: boolean]> = [
  ["as-of", "applyAsOf"],
  ["bundled-rules", "bundledRules"],
  ["cache-paths", "defaultCacheDirectory"],
  ["check", "check"],
  ["countdown", "runCountdown"],
  ["data-bundle", "buildDataBundle"],
  ["data-release-log", "verifyReleaseLog"],
  ["data-signature", "verifyArtifactSignature"],
  ["data-source", "getActiveData"],
  ["data-status", "getDataStatus"],
  ["data-update", "updateData"],
  ["domain", "LifecycleScan", true],
  ["errors", "EbbError"],
  ["export/cle", "exportCle"],
  ["forecast", "buildForecast"],
  ["lookup", "lookupProduct"],
  ["min-support", "applyMinSupport"],
  ["package-files", "findPackageFile"],
  ["product-name", "rankProductsForName"],
  ["purl", "parsePurl"],
  ["registry", "validateRegistryV2"],
  ["required", "required"],
  ["result", "daysLeft"],
  ["rule-guards", "validateRegistry"],
  ["rule-lint", "lintRuleFiles"],
  ["rule-versions", "kubernetesRuleVersion"],
  ["vers", "versContains"],
  ["vers/gem", "gemScheme"],
  ["vers/index", "versContains"],
  ["vers/maven", "mavenScheme"],
  ["vers/nuget", "nugetScheme"],
  ["vers/pep440", "pep440Scheme"],
  ["vers/semver", "semverScheme"],
  ["version", "VERSION"],
];

function analyzeVirtualFile(source: string): {
  semanticDiagnostics: readonly ts.Diagnostic[];
  deprecations: readonly ts.DiagnosticWithLocation[];
  service: ts.LanguageService;
  probeFile: string;
} {
  const repoRoot = resolve(".");
  const probeFile = resolve(repoRoot, "__deprecation_probe__.ts");
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
  };

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => options,
    getScriptFileNames: () => [probeFile],
    getScriptVersion: () => "1",
    getScriptSnapshot: (fileName) => {
      if (resolve(fileName) === probeFile) return ts.ScriptSnapshot.fromString(source);
      return existsSync(fileName) ? ts.ScriptSnapshot.fromString(readFileSync(fileName, "utf8")) : undefined;
    },
    getCurrentDirectory: () => repoRoot,
    getDefaultLibFileName: (compilerOptions) => ts.getDefaultLibFilePath(compilerOptions),
    fileExists: (fileName) => resolve(fileName) === probeFile || ts.sys.fileExists(fileName),
    readFile: (fileName) => (resolve(fileName) === probeFile ? source : ts.sys.readFile(fileName)),
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  return {
    semanticDiagnostics: service.getSemanticDiagnostics(probeFile),
    deprecations: service
      .getSuggestionDiagnostics(probeFile)
      .filter((diagnostic) => DEPRECATION_CODES.has(diagnostic.code)),
    service,
    probeFile,
  };
}

test("root @velella/ebb exports do not trigger deprecation diagnostics", () => {
  const { semanticDiagnostics, deprecations } = analyzeVirtualFile(`
import {
  type CheckAllEntry,
  type CheckAllError,
  type CheckAllErrorCode,
  type CheckAllItem,
  type CheckAllResult,
  type CheckAllSummary,
  type CheckEvent,
  type CheckMatch,
  type CheckResult,
  type CheckStatus,
  type EbbErrorCode,
  type EvidenceSource,
  type Result,
  type ResultEvent,
  type ResultMatch,
  type ResultStatus,
  type Rule,
  type RuleEvent,
  type RulesForOptions,
  check,
  checkAll,
  replacementFor,
  rulesFor,
} from "@velella/ebb";

const a: CheckResult = check("node", "18");
const b: CheckAllItem = { purl: "pkg:npm/request", version: "2.88.2" };
const c: CheckAllResult = checkAll([b]);
const d: RulesForOptions = { event: "deprecated" };
const e: Rule[] = rulesFor("pkg:npm/request", d);
const f = replacementFor("pkg:npm/node-sass", "9.0.0");
type UsedTypes =
  | CheckAllEntry
  | CheckAllError
  | CheckAllErrorCode
  | CheckAllSummary
  | CheckEvent
  | CheckMatch
  | CheckStatus
  | EbbErrorCode
  | EvidenceSource
  | Result
  | ResultEvent
  | ResultMatch
  | ResultStatus
  | RuleEvent;
export type { UsedTypes };
export { a, c, e, f };
`);
  assert.deepEqual(semanticDiagnostics, []);
  assert.deepEqual(deprecations, []);
});

test("every 0.1.0 subpath's main export shows as @deprecated in TypeScript editors", () => {
  const bindings: string[] = [];
  const lines: string[] = [];
  LEGACY_MAIN_EXPORTS.forEach(([subpath, symbol, isType], index) => {
    const alias = `legacy_${index}`;
    bindings.push(subpath);
    if (isType) {
      lines.push(`import type { ${symbol} as ${alias} } from "@velella/ebb/${subpath}";`);
      lines.push(`export type Use_${index} = ${alias};`);
    } else {
      lines.push(`import { ${symbol} as ${alias} } from "@velella/ebb/${subpath}";`);
      lines.push(`export const use_${index} = ${alias};`);
    }
  });

  const { semanticDiagnostics, deprecations, service, probeFile } = analyzeVirtualFile(lines.join("\n"));
  assert.deepEqual(semanticDiagnostics, []);
  const sourceFile = ts.createSourceFile("__deprecation_probe__.ts", lines.join("\n"), ts.ScriptTarget.ES2022, true);
  const flaggedLines = new Set(
    deprecations.map((diagnostic) => sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line),
  );

  const missing = bindings.filter((_, index) => !flaggedLines.has(index * 2 + 1) && !flaggedLines.has(index * 2));
  assert.deepEqual(missing, [], `Expected @deprecated diagnostics for legacy subpaths: ${missing.join(", ")}`);
  for (const diagnostic of deprecations) {
    const quickInfo = service.getQuickInfoAtPosition(probeFile, diagnostic.start);
    const deprecatedTag = quickInfo?.tags?.find((tag) => tag.name === "deprecated");
    const tagText = ts.displayPartsToString(deprecatedTag?.text);
    assert.match(tagText, /@velella\/ebb/);
  }
});
