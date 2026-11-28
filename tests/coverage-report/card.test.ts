import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderCoverageCard } from "../../tools/coverage/card.js";
import { buildCoverage } from "../../tools/coverage/report.js";
import { asOf, dataVersion, rule } from "./fixture.js";

test("SVG is self-contained and matches the report's actual headlines", (t) => {
  const report = buildCoverage({
    asOf,
    dataVersion,
    rules: [rule("one"), rule("two", { replacement: "Nodejs 24" })],
    checkout: "a",
    bundleSha256: "b",
    lockSha256: "c",
    runtimes: [],
    sourceLock: {},
    freshness: { nodejs: 365 },
  });
  const mark = readFileSync("docs/brand/mark-light.svg", "utf8");
  const svg = renderCoverageCard(report.headline, mark);
  assert.equal(svg, renderCoverageCard(report.headline, mark));
  assert.match(svg, /width="1200" height="630"/u);
  assert.match(svg, /2 rules, 1 components, 1 recorded gaps/u);
  assert.doesNotMatch(svg, /<script|href=|@font-face/u);
  const validate = spawnSync(
    "python3",
    [
      "-c",
      `
import json, sys, xml.etree.ElementTree as ET
svg = ET.fromstring(sys.stdin.read())
ns = {"svg": "http://www.w3.org/2000/svg"}
assert svg.find("svg:title", ns).text and svg.find("svg:desc", ns).text
print(json.dumps([node.text for node in svg.findall(".//svg:text", ns) if node.text.isdecimal()]))
`,
    ],
    { input: svg, encoding: "utf8" },
  );
  if ((validate.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
    t.diagnostic("XML parsing uses Python when present; SVG envelope and metric parity were checked.");
    return;
  }
  assert.equal(validate.status, 0, validate.stderr);
  assert.deepEqual(
    JSON.parse(validate.stdout),
    [report.headline.rules, report.headline.components, report.headline.gaps].map(String),
  );
});
