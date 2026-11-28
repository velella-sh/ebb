import assert from "node:assert/strict";
import { test } from "node:test";
import { auditGenericPurls } from "../tools/purl-audit.js";

const row = (purl: string, ecosystem: string, url = "https://vendor.example.com/support") => ({
  purl,
  ecosystem,
  sources: [{ title: "Support", url }],
});

test("inventories each generic identity and counts the rules in each ecosystem", () => {
  const rules = [
    row("pkg:generic/amazon-eks", "terraform"),
    row("pkg:generic/amazon-eks", "kubernetes"),
    row("pkg:generic/amazon-eks", "terraform", "https://vendor.example.com/releases"),
    row("pkg:docker/library/ubuntu", "container"),
    row("pkg:generic/ubuntu", "container"),
  ];
  const report = auditGenericPurls(rules);
  assert.equal(report.distinctGenericPurls, 2);
  assert.equal(report.rulesWithGenericPurl, 4);
  assert.deepEqual(report.rows[0]?.ecosystems, [
    { ecosystem: "kubernetes", rules: 1 },
    { ecosystem: "terraform", rules: 2 },
  ]);
  assert.equal(report.rows[0]?.sources.length, 2);
  assert.equal(report.rows[0]?.class, "proposed-type");
  assert.equal(report.rows[0]?.candidate, null);
  assert.equal(report.rows[1]?.class, "no-confirmed-type");
  assert.equal(report.rows[1]?.candidate, null);
  assert.deepEqual(report, auditGenericPurls([...rules].reverse()));
});

test("keeps a registered project candidate distinct from a feature or hosted runner selector", () => {
  const { rows } = auditGenericPurls([
    row("pkg:generic/nodejs", "nodejs"),
    row("pkg:generic/github-actions/set-output", "github-actions"),
    row("pkg:generic/azure-pipelines/windows-image", "ci-images"),
    row("pkg:generic/aws-unknown-tool", "terraform"),
  ]);
  const byPurl = new Map(rows.map((item) => [item.purl, item]));
  const node = byPurl.get("pkg:generic/nodejs");
  assert.equal(node?.class, "registered-type");
  assert.equal(node?.candidate, "pkg:github/nodejs/node");
  assert.match(node?.references[0] ?? "", /github-definition\.json$/u);
  assert.equal(byPurl.get("pkg:generic/github-actions/set-output")?.candidate, null);
  assert.equal(byPurl.get("pkg:generic/azure-pipelines/windows-image")?.class, "no-confirmed-type");
  assert.equal(byPurl.get("pkg:generic/aws-unknown-tool")?.class, "no-confirmed-type");
});
