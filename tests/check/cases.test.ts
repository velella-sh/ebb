import assert from "node:assert/strict";
import { test } from "node:test";

import { check, type CheckStatus } from "../../src/check.js";
import { LookupError, lookupProduct } from "../../src/lookup.js";
import { lifecycleEventPrecedence, type LifecycleEvent } from "../../src/registry.js";
import { readCases, registryRules } from "../../tools/rule-cases.js";

/** lookup's longer event names and `supported` map onto check's short status. */
const checkStatusFromLookup: Record<LifecycleEvent | "supported", CheckStatus> = {
  supported: "ok",
  deprecated: "deprecated",
  "end-of-support": "unsupported",
  "end-of-life": "end-of-life",
  removed: "removed",
  "scheduled-end-of-life": "scheduled",
};

function sortedIds(ids: readonly string[]): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function formatIds(ids: readonly string[]): string {
  return ids.length === 0 ? "none" : sortedIds(ids).join(", ");
}

/** Status the case's declared rules imply, independent of check / lookupProduct. */
function expectedStatusFromCaseRules(
  ruleIds: readonly string[],
  eventById: ReadonlyMap<string, LifecycleEvent>,
): CheckStatus {
  if (ruleIds.length === 0) return "ok";
  const events = ruleIds.map((id) => {
    const event = eventById.get(id);
    assert.ok(event !== undefined, `case names unknown rule id ${id}`);
    return event;
  });
  const primary = lifecycleEventPrecedence.find((event) => events.includes(event));
  assert.ok(primary !== undefined, `case rules have no known lifecycle event: ${formatIds(ruleIds)}`);
  return checkStatusFromLookup[primary];
}

test("every behaviour case in cases/ gets the same answer from check and lookupProduct", async () => {
  const files = await readCases(".");
  assert.ok(files.size > 0, "cases/ holds at least one file");

  const eventById = new Map((await registryRules(".")).map((rule) => [rule.id, rule.event]));
  const differences: string[] = [];

  for (const [file, cases] of files) {
    for (const item of cases) {
      const label = `${file}: ${item.purl}@${item.version}`;
      const checked = check(item.purl, item.version);
      const checkIds = checked.matches.map((match) => match.ruleId);
      const expectedIds = item.rules;
      const expectedStatus = expectedStatusFromCaseRules(expectedIds, eventById);

      if (sortedIds(checkIds).join("\n") !== sortedIds(expectedIds).join("\n")) {
        differences.push(`${label}: rules check=[${formatIds(checkIds)}] case=[${formatIds(expectedIds)}]`);
      }
      if (checked.status !== expectedStatus) {
        differences.push(
          `${label}: status check=${checked.status} case=${expectedStatus} (from rules [${formatIds(expectedIds)}])`,
        );
      }

      let lookup;
      try {
        lookup = await lookupProduct(item.purl, item.version);
      } catch (error) {
        // check returns ok for packages with no registry entry; lookup cannot resolve them.
        if (error instanceof LookupError && /Unknown product/.test(error.message)) {
          if (checked.status !== "ok" || checkIds.length !== 0) {
            differences.push(
              `${label}: lookup unknown product, but check returned status=${checked.status} rules=[${formatIds(checkIds)}]`,
            );
          }
          continue;
        }
        differences.push(`${label}: lookupProduct threw ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      const lookupStatus = checkStatusFromLookup[lookup.status];
      const lookupIds = lookup.findings.map((finding) => finding.ruleId);

      if (checked.status !== lookupStatus) {
        differences.push(`${label}: status check=${checked.status} lookup=${lookup.status} (mapped ${lookupStatus})`);
      }
      if (sortedIds(checkIds).join("\n") !== sortedIds(lookupIds).join("\n")) {
        differences.push(`${label}: rules check=[${formatIds(checkIds)}] lookup=[${formatIds(lookupIds)}]`);
      }
    }
  }

  assert.deepEqual(differences, []);
});
