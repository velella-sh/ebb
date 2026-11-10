import assert from "node:assert/strict";
import { test } from "node:test";

import { LAMBDA_RUNTIMES_URL, awsLambdaRuntimesImporter } from "../../tools/importers/serverless-1.js";
import type { ImporterContext } from "../../tools/importers/types.js";

const NOW = new Date("2026-10-15T00:00:00Z");
const header = "<tr><th>Name</th><th>Identifier</th><th>OS</th><th>Deprecation date</th></tr>";
const row = (name: string, id: string, date: string) =>
  `<tr><td><p>${name}</p></td><td><code>${id}</code></td><td><p>AL2</p></td><td><p>${date}</p></td></tr>`;

const importPage = (html: string) => {
  const context: ImporterContext = {
    now: NOW,
    async fetchText(url) {
      assert.equal(url, LAMBDA_RUNTIMES_URL);
      return html;
    },
  };
  return awsLambdaRuntimesImporter.import(context);
};

const page = (supported: string, deprecated: string) =>
  `<h2 id="runtimes-supported">S</h2><table>${header}${supported}</table>` +
  `<h2 id="runtimes-deprecated">D</h2><table>${header}${deprecated}</table>`;

test("reports a page without the supported or deprecated heading", async () => {
  const result = await importPage('<h2 id="runtimes-supported">S</h2><table></table>');
  assert.deepEqual(result.rules, []);
  assert.match(result.notes[0]!, /missing the supported or deprecated heading/);
});

test("reports a page whose headings have no table", async () => {
  const result = await importPage(
    '<h2 id="runtimes-supported">S</h2><p>none</p><h2 id="runtimes-deprecated">D</h2><p>none</p>',
  );
  assert.deepEqual(result.rules, []);
  assert.match(result.notes[0]!, /missing a supported or deprecated table/);
});

test("reports a deprecated table without identifier rows", async () => {
  const result = await importPage(page(row("Node.js 24", "nodejs24.x", "Not scheduled"), ""));
  assert.deepEqual(result.rules, []);
  assert.deepEqual(result.notes, ["No deprecated runtime rows with identifiers were found."]);
});

test("skips rows with no calendar date and rows more than a year away", async () => {
  const result = await importPage(
    page(
      row("Node.js 24", "nodejs24.x", "Not scheduled"),
      row("Node.js 14", "nodejs14.x", "TBD") + row("Node.js 99", "nodejs99.x", "Dec 1, 2030"),
    ),
  );
  assert.deepEqual(result.rules, []);
  assert.match(result.notes.join("\n"), /Skipped nodejs14\.x: deprecation cell "TBD" is not a calendar date/);
  assert.match(result.notes.join("\n"), /nodejs99\.x is deprecated on 2030-12-01, which is more than twelve months/);
});

test("an empty deprecation cell is called out as empty", async () => {
  const result = await importPage(page("", row("Node.js 14", "nodejs14.x", "")));
  assert.match(result.notes.join("\n"), /"\(empty\)"/);
});
