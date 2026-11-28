import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { RegistryV2Rule } from "../src/registry.js";
import { upcoming } from "../src/upcoming.js";
import type { ComponentRecord } from "../tools/site-data/components.js";
import { generateSiteData } from "../tools/site-data/generate.js";
import { writeSitePages } from "../tools/site-data/pages.js";
import { type SiteReleaseInput, readSiteRelease } from "../tools/site-data/release.js";

import { deadlineMonths } from "../tools/site-data/timeline.js";

const bundlePath = process.env.EBB_SITE_BUNDLE;
const signaturePath = process.env.EBB_SITE_SIGNATURE;
const historicalVerifier = process.env.EBB_SITE_RELEASED_EBB;
const version = process.env.EBB_SITE_VERSION;
const sha256 = process.env.EBB_SITE_SHA256;
const htmlDir = process.env.EBB_SITE_BUILT_HTML;
const siteTools = process.env.EBB_SITE_TOOLS;
const asOf = process.env.EBB_SITE_AS_OF ?? "2026-11-28";

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

test("deadline months preserve leap boundaries, month precision and empty months", () => {
  const rule: RegistryV2Rule = {
    id: "fixture",
    ecosystem: "npm",
    purl: "pkg:npm/fixture",
    vers: "vers:npm/*",
    event: "scheduled-end-of-life",
    title: "Fixture",
    summary: "Deadline fixture",
    severity: "low",
    sources: [],
    provenance: { observedAt: "2027-11-01", reviewedAt: "2027-11-01", reviewer: "fixture", method: "manual" },
  };
  const rules = [
    { ...rule, id: "old", deadline: "2027-12-31" },
    { ...rule, id: "month", deadline: "2028-02-29", "x-fixture": { endOfLifeMonth: "2028-02" } },
    { ...rule, id: "day", deadline: "2028-02-29" },
    { ...rule, id: "next", deadline: "2028-03-01" },
    { ...rule, id: "unknown" },
  ];
  const ruleSlugs = new Map(rules.map(({ id }) => [id, id]));
  const months = deadlineMonths({ asOf: "2028-01-15", version: "2026.11.11", rules, ruleSlugs });
  assert.deepEqual(
    months.map(({ start, end, count }) => [start, end, count]),
    [
      ["2028-01-01", "2028-01-31", 0],
      ["2028-02-01", "2028-02-29", 2],
      ["2028-03-01", "2028-03-31", 1],
    ],
  );
  const [, february, march] = months;
  assert.ok(february && march);
  assert.ok(february.agenda.includes("&quot;date&quot;:&quot;2028-02&quot;"));
  assert.ok(february.agenda.includes("&quot;date&quot;:&quot;2028-02-29&quot;"));
  assert.ok(february.agenda.indexOf("/ebb/rules/day/") < february.agenda.indexOf("/ebb/rules/month/"));
  assert.ok(march.agenda.includes("/ebb/rules/next/"));
});

test("published timeline renders overlapping windows, partial dates and an unknown end", {
  skip: !siteTools,
}, async (t) => {
  assert.ok(siteTools);
  const dir = await mkdtemp(join(tmpdir(), "ebb-timeline-fixture-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "mizzen.yml"), "title: Release timeline fixture\nbase: /ebb\nlang: en\n");
  const rows = [
    { label: "4.x", start: "2026-09-01", end: "2026-11-30", status: "ended" },
    { label: "5.x", start: "2026-10-01", end: "2027-01", status: "ending" },
    { label: "6.x", start: "2026-11-01", end: null, status: "no-known-end" },
  ];
  await writeFile(
    join(dir, "index.md"),
    `---\ntitle: Release timeline fixture\n---\n\n::timeline{items='${JSON.stringify(rows)}' caption="Release line support windows"}\n`,
  );
  const out = join(dir, "_site");
  execFileSync(
    join(siteTools, ".bin", "mizzen"),
    ["build", dir, "--theme", join(siteTools, "@velella/lateen"), "--out", out],
    { timeout: 30_000 },
  );
  const html = await readFile(join(out, "index.html"), "utf8");
  assert.ok(html.includes("<caption>Release line support windows</caption>"));
  assert.match(
    html,
    /data-field="label">4\.x<\/td>.*?datetime="2026-09-01"[^>]*>1 September 2026.*?datetime="2026-11-30"/su,
  );
  assert.match(html, /data-field="label">5\.x<\/td>.*?datetime="2026-10-01".*?datetime="2027-01"[^>]*>January 2027/su);
  assert.match(html, /data-field="label">6\.x<\/td>.*?data-field="end"><span class="timeline-ongoing">Ongoing/su);
});

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
  for (const out of [first, second]) await writeSitePages({ from, out, version, rules, asOf });
  for (const name of ["products.json", "release-lines.json", "rules.json", "deadline-months.json"]) {
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

  const months = JSON.parse(await readFile(join(first, "deadline-months.json"), "utf8")) as ReturnType<
    typeof deadlineMonths
  >;
  assert.equal(months[0]?.id, asOf.slice(0, 7));
  for (const month of months) {
    const within = Math.round((Date.parse(month.end) - Date.parse(month.start)) / 86_400_000);
    const { items } = upcoming({ asOf: month.start, within, rules });
    assert.equal(month.count, items.length);
    const monthHtml = htmlDir ? await readFile(join(htmlDir, "deadlines", month.id, "index.html"), "utf8") : "";
    if (htmlDir) {
      assert.ok(monthHtml.includes(month.title));
      assert.ok(monthHtml.includes(version));
      if (items.length === 0) assert.ok(monthHtml.includes("Nothing this month."));
    }
    for (const item of items) {
      const rule = rulePages.find(({ id }) => id === item.ruleId);
      assert.ok(rule);
      const url = `/ebb/rules/${rule.slug}/`;
      assert.ok(month.agenda.includes(url));
      if (htmlDir) {
        assert.ok(monthHtml.includes(`class="dated-list-link" href="${url}"`));
        const date = item.datePrecision === "month" ? month.id : item.deadline;
        assert.ok(monthHtml.includes(`datetime="${date}"`));
        for (const source of item.sources)
          assert.ok(monthHtml.includes(`href="${source.url.replaceAll("&", "&amp;")}"`));
      }
    }
  }

  if (htmlDir) {
    const schedule = await readFile(join(htmlDir, "deadlines", "index.html"), "utf8");
    assert.ok(schedule.includes(`href="/ebb/deadlines/${months[0]?.id}/"`));
    const timeline = await readFile(join(htmlDir, "products", "database-aws-rds-postgres", "index.html"), "utf8");
    assert.ok(timeline.includes('class="timeline"'));
    assert.match(
      timeline,
      /data-field="label">10\.x<\/td>.*?data-field="end"><span class="timeline-ongoing">Ongoing/su,
    );
    assert.ok(timeline.includes('datetime="2024-02-29"'));
    assert.ok(timeline.includes('datetime="2027-02-28"'));
    assert.ok(timeline.includes('href="/ebb/release-lines/database-aws-rds-postgres-line-10-x/"'));
    assert.ok(timeline.includes('href="/ebb/rules/database-aws-rds-postgres-end-of-support-10/"'));
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
