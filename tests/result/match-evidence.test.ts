import assert from "node:assert/strict";
import { test } from "node:test";

import { check } from "../../src/check.js";
import { isIsoDate } from "../../src/registry.js";
import { readCases, registryRules } from "../../tools/rule-cases.js";

/** Fixed calendar day so daysLeft stays clock-free in tests. */
const AS_OF = "2026-04-01";

test("every match in cases/ includes non-optional sources and reviewedAt from its rule", async () => {
  const files = await readCases(".");
  assert.ok(files.size > 0, "cases/ holds at least one file");

  const ruleById = new Map((await registryRules(".")).map((rule) => [rule.id, rule]));
  let matchCount = 0;

  for (const [file, cases] of files) {
    for (const item of cases) {
      for (const result of [check(item.purl, item.version), check(item.purl, item.version, AS_OF)]) {
        for (const match of result.matches) {
          matchCount += 1;
          const rule = ruleById.get(match.ruleId);
          assert.ok(rule !== undefined, `${file}: missing rule ${match.ruleId}`);

          assert.ok(
            Array.isArray(match.sources) && match.sources.length > 0,
            `${file}: ${item.purl}@${item.version} (${match.ruleId}) must have non-empty sources`,
          );
          for (const source of match.sources) {
            assert.match(source.url, /^https:\/\//, `${file}: ${match.ruleId} source url must be https`);
            assert.ok(source.title.trim().length > 0, `${file}: ${match.ruleId} source title must be non-empty`);
          }
          assert.deepEqual(match.sources, rule.sources);

          assert.equal(typeof match.reviewedAt, "string", `${file}: ${match.ruleId} reviewedAt must be a string`);
          assert.ok(
            isIsoDate(match.reviewedAt),
            `${file}: ${match.ruleId} reviewedAt (${match.reviewedAt}) must be YYYY-MM-DD`,
          );
          assert.equal(match.reviewedAt, rule.provenance.reviewedAt);
        }
      }
    }
  }

  assert.ok(matchCount > 0, "cases/ must exercise at least one matching rule");
});
