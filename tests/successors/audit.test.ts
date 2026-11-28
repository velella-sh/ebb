import assert from "node:assert/strict";
import { test } from "node:test";
import { auditSuccessors, successorKinds } from "../../tools/successors-audit.js";
import { rule } from "../coverage-report/fixture.js";

test("includes each text-only rule, classifies explicit suggestions, and preserves ambiguity", () => {
  const values = [
    "npm install example",
    "Nodejs 24 or later",
    "apps.example.io/v1 Ingress",
    "Switch to Managed Example service",
    "No supported replacement",
    "Follow the current upstream recommendations",
  ];
  const rules = values.map((replacement, i) => rule(String(i), { replacement }));
  rules.push(
    rule("structured", {
      replacement: "Already structured",
      replacements: [{ purl: "pkg:npm/demo", name: "Demo", kind: "successor" }],
    }),
  );
  rules.push(rule("without"));
  const report = auditSuccessors(rules);
  assert.equal(report.rules, 8);
  assert.equal(report.textOnly, 6);
  assert.deepEqual(
    report.rows.map(({ classification }) => classification),
    [...successorKinds],
  );
  assert.deepEqual(report, auditSuccessors([...rules].reverse()));
});
