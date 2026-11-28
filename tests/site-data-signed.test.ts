import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { ComponentRecord } from "../tools/site-data/components.js";
import { generateSiteData } from "../tools/site-data/generate.js";
import { writeSitePages } from "../tools/site-data/pages.js";
import { type SiteReleaseInput, readSiteRelease } from "../tools/site-data/release.js";

const bundlePath = process.env.EBB_SITE_BUNDLE;
const signaturePath = process.env.EBB_SITE_SIGNATURE;
const historicalVerifier = process.env.EBB_SITE_RELEASED_EBB;
const version = process.env.EBB_SITE_VERSION;
const sha256 = process.env.EBB_SITE_SHA256;
const htmlDir = process.env.EBB_SITE_BUILT_HTML;

type Product = Pick<ComponentRecord, "id" | "slug" | "title" | "ecosystem" | "status">;

async function checkProductIndexes(dir: string, products: readonly Product[]) {
  const landing = await readFile(join(dir, "products", "index.html"), "utf8");
  const indexes = [
    { field: "ecosystem", route: "by-ecosystem", sample: "npm" },
    { field: "status", route: "by-status", sample: "end-of-life" },
  ] as const;
  for (const { field, route, sample } of indexes) {
    const root = `/ebb/products/${route}`;
    assert.ok(landing.includes(`href="${root}/"`));
    const overview = await readFile(join(dir, "products", route, "index.html"), "utf8");
    const groups = [...new Set(products.map((product) => product[field]))].sort();
    const groupLinks = [...overview.matchAll(/<a href="([^"]+)">[^<]+ <span class="list-group-count">(\d+)<\/span>/gu)];
    assert.deepEqual(
      groupLinks.map((link) => [link[1], Number(link[2])]),
      groups.map((key) => [`${root}/${key}/`, products.filter((product) => product[field] === key).length]),
    );

    const members = products
      .filter((product) => product[field] === sample)
      .sort((a, b) => (a.title === b.title ? (a.id < b.id ? -1 : 1) : a.title < b.title ? -1 : 1));
    const paged = join(dir, "products", route, sample);
    const first = await readFile(join(paged, "index.html"), "utf8");
    const second = await readFile(join(paged, "page", "2", "index.html"), "utf8");
    assert.ok(first.includes(`href="${root}/${sample}/page/2/"`));
    assert.ok(second.includes(`href="${root}/${sample}/"`));
    for (const [index, page] of [first, second].entries()) {
      const body = /<tbody>(.*?)<\/tbody>/su.exec(page)?.[1];
      assert.ok(body);
      const links = [...body.matchAll(/<a href="(\/ebb\/products\/[a-z0-9-]+\/)"/gu)].map((link) => link[1]);
      assert.deepEqual(
        links,
        members.slice(index * 40, (index + 1) * 40).map(({ slug }) => `/ebb/products/${slug}/`),
      );
    }
    await readFile(join(dir, "products", members[0]!.slug, "index.html"), "utf8");
  }
}

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
  for (const name of ["products.json", "release-lines.json", "rules.json"]) {
    assert.deepEqual(await readFile(join(first, name)), await readFile(join(second, name)));
  }
  await assert.rejects(writeSitePages({ from, out: second, version: "2027.01.01", rules }), /Invalid site collection/);

  const products = JSON.parse(await readFile(join(first, "products.json"), "utf8"));
  const sourceProducts = JSON.parse(await readFile(join(from, "components.json"), "utf8")).records as ComponentRecord[];
  const grouping = ({ id, ecosystem, status }: Product) => [id, ecosystem, status];
  assert.deepEqual(products.map(grouping), sourceProducts.map(grouping));
  const product = products.find(({ purl }: { purl: string }) => purl === "pkg:generic/nodejs");
  const sortedReleaseLines = JSON.parse(await readFile(join(first, "release-lines.json"), "utf8"));
  const line = sortedReleaseLines.find(
    ({ purl, line }: { purl: string; line: string }) => purl === product.purl && line === "20.x",
  );
  assert.ok(product.releaseLines.includes(line.id));
  assert.equal(line.product, product.id);
  assert.equal(line.dataVersion, version);
  assert.equal(line.precision, "day");
  const { check, rulesFor } = await import(pathToFileURL(join(historicalVerifier, "dist/src/index.js")).href);
  const match = check(line.purl, "20.11.0").matches.find(({ ruleId }: { ruleId: string }) => ruleId === line.ruleId);
  assert.equal(line.deadline, match.date);
  assert.equal(line.claims.deadline[0].url, match.sources[0].url);

  const rulePages = JSON.parse(await readFile(join(first, "rules.json"), "utf8")) as Array<{
    id: string;
    slug: string;
    dataVersion: string;
    purl: string;
    vers: string;
    status: string;
    deadline: string | null;
    precision: string;
    reviewedAt: string;
    reviewers: string[];
    replacement?: string;
    product: string;
    claims: { status: { url: string }[] };
  }>;
  assert.equal(new Set(rulePages.map((rule) => rule.id)).size, rules.length);
  assert.equal(new Set(rulePages.map((rule) => rule.slug)).size, rules.length);
  const fixtures = [
    { id: line.ruleId, slug: "nodejs-runtime-eol-20", version: "20.11.0", label: "End of life", date: "2026-04-30" },
    {
      id: "npm.package.abab.deprecated",
      slug: "npm-package-abab-deprecated",
      version: "2.0.6",
      label: "Deprecated",
      date: null,
    },
  ];
  for (const fixture of fixtures) {
    const record = rulePages.find((rule) => rule.id === fixture.id);
    assert.ok(record);
    const parent = products.find(({ id }: { id: string }) => id === record.product);
    assert.ok(parent);
    const definition = rulesFor(record.purl).find(({ id }: { id: string }) => id === record.id);
    const matchingRule = check(record.purl, fixture.version).matches.find(
      ({ ruleId }: { ruleId: string }) => ruleId === record.id,
    );
    assert.ok(definition && matchingRule);
    assert.equal(record.slug, fixture.slug);
    assert.equal(record.dataVersion, version);
    assert.equal(record.vers, definition.vers);
    assert.equal(record.status, matchingRule.event);
    assert.equal(record.deadline, fixture.date);
    assert.equal(record.deadline, matchingRule.date);
    assert.equal(record.precision, fixture.date ? "day" : "No published date");
    assert.equal(record.reviewedAt, matchingRule.reviewedAt);
    assert.deepEqual(
      record.claims.status.map(({ url }) => url),
      matchingRule.sources.map(({ url }: { url: string }) => url),
    );
    assert.equal(record.replacement, matchingRule.replacement ?? undefined);

    if (htmlDir) {
      const productUrl = `/ebb/products/${parent.slug}/`;
      const ruleUrl = `/ebb/rules/${fixture.slug}/`;
      const productHtml = await readFile(join(htmlDir, "products", parent.slug, "index.html"), "utf8");
      const ruleHtml = await readFile(join(htmlDir, "rules", fixture.slug, "index.html"), "utf8");
      assert.ok(productHtml.includes(`href="${ruleUrl}"`), `missing link to ${ruleUrl}`);
      assert.ok(ruleHtml.includes(`href="${productUrl}"`), `missing link to ${productUrl}`);
      assert.ok(ruleHtml.includes(`class="status-label">${fixture.label}</span>`));
      assert.ok(ruleHtml.includes(fixture.date ?? "No published date"));
      assert.ok(ruleHtml.includes(record.id));
      assert.ok(ruleHtml.includes(record.purl));
      assert.ok(ruleHtml.replaceAll("&lt;", "<").replaceAll("&gt;", ">").includes(record.vers));
      assert.ok(ruleHtml.includes(version));
      assert.ok(ruleHtml.includes(record.reviewedAt));
      assert.ok(ruleHtml.includes(record.reviewers[0]!));
      if (record.replacement) assert.ok(ruleHtml.includes(record.replacement));
      for (const source of record.claims.status) assert.ok(ruleHtml.includes(`href="${source.url}"`));
    }
  }
  assert.ok(!check(line.purl, "22.0.0").matches.some(({ ruleId }: { ruleId: string }) => ruleId === line.ruleId));

  if (htmlDir) {
    await checkProductIndexes(htmlDir, products);
    const productUrl = `/ebb/products/${product.slug}/`;
    const lineUrl = `/ebb/release-lines/${line.slug}/`;
    const productHtml = await readFile(join(htmlDir, "products", product.slug, "index.html"), "utf8");
    const lineHtml = await readFile(join(htmlDir, "release-lines", line.slug, "index.html"), "utf8");
    assert.ok(productHtml.includes(`href="${lineUrl}"`), `missing link to ${lineUrl}`);
    assert.ok(lineHtml.includes(`href="${productUrl}"`), `missing link to ${productUrl}`);
    assert.ok(lineHtml.includes('href="/ebb/rules/nodejs-runtime-eol-20/"'));
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
