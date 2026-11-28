import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { generateSiteData } from "../tools/site-data/generate.js";
import { writeSitePages } from "../tools/site-data/pages.js";
import { readSiteRelease } from "../tools/site-data/release.js";
import { readSiteReleaseLog } from "../tools/site-data/releases.js";

const bundlePath = process.env.EBB_SITE_BUNDLE;
const signaturePath = process.env.EBB_SITE_SIGNATURE;
const version = process.env.EBB_SITE_VERSION;
const sha256 = process.env.EBB_SITE_SHA256;
const htmlDir = process.env.EBB_SITE_BUILT_HTML;

const parseFeedXml = `
import json
import sys
import xml.etree.ElementTree as xml

rss = xml.parse(sys.argv[1]).getroot()
atom = xml.parse(sys.argv[2]).getroot()
ns = {"a": "http://www.w3.org/2005/Atom"}
assert rss.tag == "rss" and rss.attrib["version"] == "2.0"
assert atom.tag == "{http://www.w3.org/2005/Atom}feed"
assert rss.find("channel/title") is not None and atom.find("a:title", ns) is not None
rss_items = [
    dict(id=item.findtext("guid"), url=item.findtext("link"), title=item.findtext("title"),
         date=item.findtext("pubDate"), summary=item.findtext("description"))
    for item in rss.findall("channel/item")
]
atom_items = [
    dict(id=item.findtext("a:id", namespaces=ns), url=item.find("a:link[@rel='alternate']", ns).attrib["href"],
         title=item.findtext("a:title", namespaces=ns), date=item.findtext("a:updated", namespaces=ns),
         summary=item.findtext("a:summary", namespaces=ns))
    for item in atom.findall("a:entry", ns)
]
print(json.dumps([rss_items, atom_items]))
`;

interface FeedEntry {
  id: string;
  url: string;
  title: string;
  date: string;
  summary: string;
}

interface PageJson {
  url: string;
  record: {
    id: string;
    collection: string;
    fields: Record<string, unknown>;
    evidence?: Record<string, { id: string; title: string; url: string }[]>;
  };
}

test("signed release feeds and adjacent JSON agree with the published snapshot", {
  skip: !(bundlePath && signaturePath && version && sha256 && htmlDir),
}, async (t) => {
  assert.ok(bundlePath && signaturePath && version && sha256 && htmlDir);
  const input = { bundlePath, signaturePath, version, sha256, historicalVerifier: process.env.EBB_SITE_RELEASED_EBB };
  const rules = await readSiteRelease(input);
  const releaseLog = await readSiteReleaseLog(input);
  const latest = releaseLog.at(-1);
  assert.ok(latest);
  await assert.rejects(readSiteReleaseLog({ ...input, sha256: "0".repeat(64) }), /does not match site bundle/);

  const dir = await mkdtemp(join(tmpdir(), "ebb-site-feeds-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await copyFile(
    join(dirname(bundlePath), "release-log.jsonl.sigstore.json"),
    join(dir, "release-log.jsonl.sigstore.json"),
  );
  await writeFile(join(dir, "release-log.jsonl"), "{}\n");
  await assert.rejects(readSiteReleaseLog({ ...input, bundlePath: join(dir, "bundle.json") }), /digest|signatur/i);

  const source = join(dir, "source");
  await generateSiteData({ outDir: source, dataVersion: version, rules });
  for (const candidate of ["first", "second"]) {
    await writeSitePages({ from: source, out: join(dir, candidate), version, rules, releaseLog });
  }
  const releaseRecords = await readFile(join(dir, "first", "data-releases.json"));
  assert.deepEqual(releaseRecords, await readFile(join(dir, "second", "data-releases.json")));

  const atom = join(htmlDir, "atom.xml");
  const rss = join(htmlDir, "feed.xml");
  assert.deepEqual(await readFile(atom), await readFile(join(htmlDir, "data-changelog.atom")));
  assert.deepEqual(await readFile(atom), await readFile(join(htmlDir, "feeds", "data-releases.xml")));
  assert.deepEqual(await readFile(rss), await readFile(join(htmlDir, "feeds", "data-releases.rss.xml")));
  const [rssEntries, atomEntries] = JSON.parse(
    execFileSync("python3", ["-c", parseFeedXml, rss, atom], {
      encoding: "utf8",
    }),
  ) as [FeedEntry[], FeedEntry[]];
  const normalize = (entries: FeedEntry[]) =>
    entries.map((entry) => ({ ...entry, date: new Date(entry.date).toISOString() }));
  assert.deepEqual(normalize(rssEntries), normalize(atomEntries));
  assert.equal(new Set(atomEntries.map(({ id }) => id)).size, Math.min(releaseLog.length, 50));
  const canonical = `/ebb/data-releases/${version}/`;
  const entry = atomEntries[0];
  assert.ok(entry);
  assert.equal(entry.url, `https://velella.sh${canonical}`);
  assert.equal(entry.title, `Ebb lifecycle data ${version}`);
  assert.equal(Date.parse(entry.date), Date.parse(latest.createdAt));
  assert.ok(entry.summary.includes(`${rules.length} rules`));

  const releaseIndex = await readFile(join(htmlDir, "data-releases", "index.html"), "utf8");
  assert.ok(releaseIndex.includes('href="https://velella.sh/ebb/feeds/data-releases.xml"'));
  assert.ok(releaseIndex.includes('href="https://velella.sh/ebb/feeds/data-releases.rss.xml"'));
  const released = JSON.parse(
    await readFile(join(htmlDir, "data-releases", version, "index.json"), "utf8"),
  ) as PageJson;
  assert.equal(released.url, canonical);
  assert.equal(released.record.id, version);
  assert.equal(released.record.fields.bundleSha256, latest.bundleSha256);
  assert.equal(released.record.fields.contentDigest, latest.contentDigest);

  for (const [collection, slug] of [
    ["products", "nodejs-nodejs"],
    ["release-lines", "nodejs-nodejs-line-20-x"],
    ["rules", "nodejs-runtime-eol-20"],
  ] as const) {
    const route = `/ebb/${collection}/${slug}/`;
    const document = JSON.parse(await readFile(join(htmlDir, collection, slug, "index.json"), "utf8")) as PageJson;
    const records = JSON.parse(await readFile(join(dir, "first", `${collection}.json`), "utf8")) as Record<
      string,
      unknown
    >[];
    const expected = records.find((record) => record.slug === slug);
    assert.ok(expected);
    const { claims, ...fields } = expected as Record<string, unknown> & {
      claims: NonNullable<PageJson["record"]["evidence"]>;
    };

    assert.equal(document.url, route);
    assert.equal(document.record.id, fields.id);
    assert.equal(document.record.collection, collection);
    assert.equal(document.record.fields.dataVersion, version);
    assert.deepEqual(document.record.fields, fields);
    const evidence = Object.fromEntries(Object.entries(claims).filter(([, links]) => links.length > 0));
    assert.deepEqual(document.record.evidence, evidence);
  }
});
