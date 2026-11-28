import assert from "node:assert/strict";
import { test } from "node:test";

import { triageProduct } from "../../tools/new-product-triage.js";
import { evidenceUrl, publicAddress } from "../../tools/new-rule-source.js";

const form = (url: string) =>
  `### Package URL (purl)\n\npkg:generic/nodejs\n\n### Authoritative Evidence URL\n\n${url}\n`;
const source = form("https://nodejs.org/about");
const unreachable = async () => {
  throw new Error("Timed out");
};

test("triage distinguishes explicit lifecycle dates, policy-only, and unreachable evidence", async () => {
  const dated = await triageProduct(source, async () => "<p>End of support: <b>April 30, 2026</b>.</p>");
  assert.equal(dated.dated, true);
  assert.match(dated.comment, /April 30, 2026/);
  assert.match(dated.comment, /pkg:generic\/nodejs/);
  assert.match(dated.comment, /npm run new-rule/);

  const policy = await triageProduct(source, async () => "<p>Our end-of-life policy is five years of support.</p>");
  assert.equal(policy.dated, false);
  assert.match(policy.comment, /policy wording/);

  const unavailable = await triageProduct(source, unreachable);
  assert.equal(unavailable.dated, false);
  assert.match(unavailable.comment, /could not be read/);
});

test("the EOL table column beats unrelated dates in the same row", async () => {
  const result = await triageProduct(
    source,
    async () =>
      "<table><tr><th>First release</th><th>End of life</th></tr>" +
      "<tr><td>2020-10-05</td><td>2025-10-31</td></tr></table>",
  );
  assert.equal(result.dated, true);
  assert.match(result.comment, /2025-10-31/);
  assert.doesNotMatch(result.comment, /2020-10-05/);
});

test("the public evidence boundary rejects private addresses and credentialed endpoints", async () => {
  const privateUrl = await triageProduct(form("https://localhost/data"), () => assert.fail("No network permitted"));
  assert.equal(privateUrl.dated, false);
  assert.match(privateUrl.comment, /public HTTPS/);
  assert.throws(() => evidenceUrl("https://user:secret@nodejs.org/"), /public HTTPS/);
  assert.equal(publicAddress("127.0.0.1"), false);
  assert.equal(publicAddress("169.254.169.254"), false);
  assert.equal(publicAddress("::1"), false);
  assert.equal(publicAddress("8.8.8.8"), true);
});
