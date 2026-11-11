import assert from "node:assert/strict";
import { test } from "node:test";

import type { RegistryV2Rule } from "../../src/registry.js";
import {
  COMPILED_VERS_RANGE,
  compileRulesVers,
  compileRuleVers,
  getCompiledVers,
  type RuleWithCompiledVers,
} from "../../src/vers/compile.js";

const sampleRule: RegistryV2Rule = {
  id: "TEST-1",
  purl: "pkg:npm/example",
  ecosystem: "npm",
  event: "end-of-life",
  severity: "high",
  title: "Test rule",
  summary: "Test summary",
  vers: "vers:npm/>=1.0.0|<2.0.0",
  sources: [{ title: "test", url: "https://example.com" }],
  provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
};

test("compileRuleVers parses and caches compiled vers range on the rule object", () => {
  const rule: RegistryV2Rule = { ...sampleRule };
  assert.equal((rule as RuleWithCompiledVers)[COMPILED_VERS_RANGE], undefined);

  const compiled = compileRuleVers(rule);
  assert.ok(compiled);
  assert.equal(compiled.scheme, "npm");
  assert.equal(compiled.constraints.length, 2);

  // Symbol property is set on the rule object
  assert.equal((rule as RuleWithCompiledVers)[COMPILED_VERS_RANGE], compiled);

  // Subsequent call returns the exact same cached reference
  const second = getCompiledVers(rule);
  assert.strictEqual(second, compiled);
});

test("compileRulesVers compiles an array of rules in place", () => {
  const rules: RegistryV2Rule[] = [
    { ...sampleRule, id: "R1" },
    { ...sampleRule, id: "R2" },
  ];
  compileRulesVers(rules);

  for (const rule of rules) {
    assert.ok((rule as RuleWithCompiledVers)[COMPILED_VERS_RANGE]);
  }
});
