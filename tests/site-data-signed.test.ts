import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { generateSiteData } from "../tools/site-data/generate.js";
import { writeSitePages } from "../tools/site-data/pages.js";
import { type SiteReleaseInput, readSiteRelease } from "../tools/site-data/release.js";

const bundlePath = process.env.EBB_SITE_BUNDLE;
const signaturePath = process.env.EBB_SITE_SIGNATURE;
const historicalVerifier = process.env.EBB_SITE_RELEASED_EBB;
const version = process.env.EBB_SITE_VERSION;
const sha256 = process.env.EBB_SITE_SHA256;
const htmlDir = process.env.EBB_SITE_BUILT_HTML;

test("signed site data verifies the pinned bundle, builds deterministic records and rejects bad inputs", {
  skip: !(bundlePath && signaturePath && historicalVerifier && version && sha256),
}, async (t) => {
  assert.ok(bundlePath && signaturePath && historicalVerifier && version && sha256);
  const dir = await mkdtemp(join(tmpdir(), "ebb-signed-site-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input: SiteReleaseInput = { bundlePath, signaturePath, version, sha256, historicalVerifier };

  const rules = await readSiteRelease(input);
  assert.ok(rules.some((rule) => rule.id === "nodejs.runtime.eol-20"));
  await assert.rejects(readSiteRelease({ ...input, sha256: "0".repeat(64) }), /SHA-256 mismatch/);
  await assert.rejects(readSiteRelease({ ...input, version: "2027.01.01" }), /historical verifier is only allowed/);

  const badSignature = join(dir, "bad-signature.json");
  await writeFile(badSignature, "{}\n");
  await assert.rejects(readSiteRelease({ ...input, signaturePath: badSignature }), /[Ss]ignature|Sigstore|bundle/);

  const from = join(dir, "site-data");
  await generateSiteData({ outDir: from, dataVersion: version, rules });
  const first = join(dir, "first");
  const second = join(dir, "second");
  for (const out of [first, second]) await writeSitePages({ from, out, version, rules });
  for (const name of ["products.json", "release-lines.json"]) {
    assert.deepEqual(await readFile(join(first, name)), await readFile(join(second, name)));
  }
  await assert.rejects(writeSitePages({ from, out: second, version: "2027.01.01", rules }), /Invalid site collection/);

  const products = JSON.parse(await readFile(join(first, "products.json"), "utf8"));
  const product = products.find(({ purl }: { purl: string }) => purl === "pkg:generic/nodejs");
  const sortedReleaseLines = JSON.parse(await readFile(join(first, "release-lines.json"), "utf8"));
  const line = sortedReleaseLines.find(
    ({ purl, line }: { purl: string; line: string }) => purl === product.purl && line === "20.x",
  );
  assert.ok(product.releaseLines.includes(line.id));
  assert.equal(line.product, product.id);
  assert.equal(line.dataVersion, version);
  assert.equal(line.precision, "day");
  const { check } = await import(pathToFileURL(join(historicalVerifier, "dist/src/index.js")).href);
  const match = check(line.purl, "20.11.0").matches.find(({ ruleId }: { ruleId: string }) => ruleId === line.ruleId);
  assert.equal(line.deadline, match.date);
  assert.equal(line.claims.deadline[0].url, match.sources[0].url);

  if (htmlDir) {
    const productUrl = `/ebb/products/${product.slug}/`;
    const lineUrl = `/ebb/release-lines/${line.slug}/`;
    const productHtml = await readFile(join(htmlDir, "products", product.slug, "index.html"), "utf8");
    const lineHtml = await readFile(join(htmlDir, "release-lines", line.slug, "index.html"), "utf8");
    assert.ok(productHtml.includes(`href="${lineUrl}"`), `missing link to ${lineUrl}`);
    assert.ok(lineHtml.includes(`href="${productUrl}"`), `missing link to ${productUrl}`);
    assert.ok(lineHtml.includes(line.deadline));
    assert.ok(lineHtml.includes(line.claims.deadline[0].url));
    for (const html of [productHtml, lineHtml]) {
      assert.ok(html.includes("Signed data version"));
      assert.ok(html.includes(version));
    }
  }

  await writeFile(join(from, "components.json"), JSON.stringify({ dataVersion: version, records: [null] }));
  await assert.rejects(writeSitePages({ from, out: second, version, rules }), /Invalid site collection/);
});
