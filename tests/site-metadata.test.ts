import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const dir = process.env.EBB_SITE_BUILT_HTML;
const origin = "https://velella.sh";
const base = "/ebb";
const month = (process.env.EBB_SITE_AS_OF ?? "2026-11-28").slice(0, 7);

const entities: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};
const decoded = (text: string): string => text.replace(/&(?:amp|quot|#39|lt|gt);/gu, (entity) => entities[entity]!);

interface StructuredData {
  "@context": string;
  "@type": string;
  "@id"?: string;
  url?: string;
  image?: string;
  headline?: string;
  name?: string;
  description?: string;
  version?: string;
  identifier?: string;
  itemListElement?: { position: number; url: string }[];
}

test("built lifecycle pages publish unique canonical metadata and generated share images", { skip: !dir }, async () => {
  assert.ok(dir);
  const routes = [
    "products/nodejs-nodejs/",
    "rules/nodejs-runtime-eol-20/",
    "release-lines/nodejs-nodejs-line-20-x/",
    "products/by-ecosystem/npm/",
    "products/by-status/end-of-life/",
    `deadlines/${month}/`,
    "release-comparisons/nodejs-nodejs/20-x-vs-22-x/",
  ];
  const sitemap = await readFile(join(dir, "sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => decoded(match[1]!));
  assert.equal(new Set(urls).size, urls.length);
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const images = new Set<string>();
  const imageDigests = new Set<string>();

  for (const route of routes) {
    const html: string = await readFile(join(dir, route, "index.html"), "utf8");
    const head = html.split("</head>")[0] ?? "";
    const canonical = `${origin}${base}/${route}`;
    const canonicals = [...head.matchAll(/<link rel="canonical" href="([^"]+)"/gu)].map((match) => match[1]);
    assert.deepEqual(canonicals, [canonical], route);
    assert.ok(urls.includes(canonical), `${route} is missing from the sitemap`);

    const metadata = [...head.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)"/gu)];
    const meta = (name: string): string => {
      const values = metadata.filter((match) => match[1] === name);
      assert.equal(values.length, 1, `${route} must have one ${name}`);
      return decoded(values[0]![2]!);
    };
    const title = /<title>([^<]+)<\/title>/u.exec(head)?.[1];
    assert.ok(title);
    const description = meta("description");
    assert.ok(description.length > 0);
    assert.equal(meta("og:url"), canonical);
    assert.equal(meta("og:title"), decoded(title));
    assert.equal(meta("og:description"), description);

    const image = new URL(meta("og:image"));
    assert.equal(image.origin, origin);
    assert.equal(image.pathname, `${base}/assets/social/${route.slice(0, -1)}.png`);
    assert.equal(meta("og:image:width"), "1200");
    assert.equal(meta("og:image:height"), "630");
    assert.equal(meta("twitter:card"), "summary_large_image");
    const png: Buffer = await readFile(join(dir, image.pathname.slice(base.length + 1)));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);

    const structured = [...head.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/gu)].map(
      (match) => JSON.parse(match[1]!) as StructuredData,
    );
    assert.ok(structured.every((entry) => entry["@context"] === "https://schema.org" && entry["@type"].length > 0));
    const subjects = structured.flatMap((entry) => entry["@id"] ?? entry.url ?? []);
    assert.equal(new Set(subjects).size, subjects.length, `${route} must have unique JSON-LD subject URLs`);
    const article = structured.filter((entry) => entry["@type"] === "TechArticle");
    assert.equal(article.length, 1);
    assert.equal(article[0]!.url, canonical);
    assert.equal(article[0]!.headline, decoded(title));
    assert.equal(article[0]!.description, description);
    assert.equal(article[0]!.image, image.href);

    if (route === routes[0] || route === routes[1]) {
      const isProduct = route === routes[0];
      const data = structured.find((entry) => entry["@type"] === "Dataset");
      assert.ok(data);
      assert.equal(data["@id"], `${canonical}#${isProduct ? "lifecycle-data" : "rule-data"}`);
      assert.equal(data.name, decoded(title));
      assert.equal(data.description, description);
      assert.equal(data.version, process.env.EBB_SITE_VERSION);
      assert.equal(data.identifier, isProduct ? "pkg:generic/nodejs" : "nodejs.runtime.eol-20");
    }
    if (route.startsWith("products/by-")) {
      const lists = structured.filter((entry) => entry["@type"] === "ItemList");
      assert.equal(lists.length, 1);
      const items = lists[0]!.itemListElement ?? [];
      assert.ok(items.length > 0);
      assert.equal(new Set(items.map(({ url }) => url)).size, items.length);
      assert.ok(items.every(({ position, url }, index) => position === index + 1 && urls.includes(url)));
    }

    titles.add(decoded(title));
    descriptions.add(description);
    images.add(image.href);
    imageDigests.add(createHash("sha256").update(png).digest("hex"));
  }

  for (const distinct of [titles, descriptions, images, imageDigests]) assert.equal(distinct.size, routes.length);
  assert.match(
    sitemap,
    /<loc>https:\/\/velella\.sh\/ebb\/rules\/nodejs-runtime-eol-20\/<\/loc>\s*<lastmod>2026-10-17<\/lastmod>/u,
  );
});
