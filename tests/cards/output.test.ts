import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { RegistryV2Rule } from "../../src/registry.js";
import { CARD_MAX_BYTES, CARDS_MAX_BYTES, MAX_CARD_ROWS } from "../../tools/cards/render.js";
import type { CardIndexEntry } from "../../tools/static-api/cards.js";
import { generateStaticApi, sha256Hex } from "../../tools/static-api/generate.js";

type CardIndex = Record<string, { card?: CardIndexEntry }>;

async function readIndex(out: string): Promise<CardIndex> {
  const index = JSON.parse(await readFile(join(out, "index.json"), "utf8")) as { components: CardIndex };
  return index.components;
}

test("timeline cards use fixture rules and retain the namespace in the path", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ebb-card-fixture-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const out = join(root, "out");
  const purl = "pkg:npm/%40sample/runtime";
  const rule: RegistryV2Rule = {
    purl,
    id: "npm.example.end",
    ecosystem: "npm",
    vers: "vers:npm/>=2.0.0|<3.0.0",
    event: "scheduled-end-of-life",
    deadline: "2027-11-28",
    title: "Runtime 2 support ends",
    summary: "Example deadline.",
    severity: "high",
    sources: [{ title: "Example", url: "https://example.org", accessedAt: "2026-11-28" }],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "test", method: "manual" },
  };
  await mkdir(join(root, "registry"));
  await writeFile(join(root, "package.json"), JSON.stringify({ version: "0.0.0" }), "utf8");
  await writeFile(join(root, "registry/npm.json"), JSON.stringify({ ecosystem: "npm", rules: [rule] }), "utf8");
  await generateStaticApi({ root, outDir: out, baseUrl: "https://example.org/api" });
  const entry = (await readIndex(out))[purl]?.card;
  assert.equal(entry?.path, "cards/npm/@sample/runtime.svg");
  const svg = await readFile(join(out, entry.path), "utf8");
  assert.equal(entry.sha256, sha256Hex(svg));
  assert.equal(entry.bytes, Buffer.byteLength(svg));
  assert.match(svg, /@sample\/runtime lifecycle timeline/u);
  assert.match(svg, /release date unknown, standard support ends 2027-11-28/u);
  assert.match(svg, /href="https:\/\/example\.org\/api\/npm\/@sample\/runtime\.json"/u);
  assert.doesNotMatch(svg, /class="standard segment" d="M\d+ \d+H\d+"/u);
});

test("published SVG paths, digests, XML accessibility and size budgets", async (t) => {
  const out = await mkdtemp(join(tmpdir(), "ebb-card-output-"));
  t.after(() => rm(out, { recursive: true, force: true }));
  await generateStaticApi({ outDir: out });
  const index = await readIndex(out);
  const cards = Object.values(index).flatMap(({ card }) => (card ? [card] : []));
  assert.ok(cards.length >= 20);
  assert.deepEqual(
    (await readdir(join(out, "cards"), { recursive: true })).filter((entry) => entry.endsWith(".svg")).sort(),
    cards.map(({ path }) => path.slice("cards/".length)).sort(),
  );
  let totalBytes = 0;
  for (const card of cards) {
    const bytes = await readFile(join(out, card.path));
    assert.equal(card.bytes, bytes.length, card.path);
    assert.equal(card.sha256, sha256Hex(bytes), card.path);
    assert.ok(card.bytes <= CARD_MAX_BYTES, card.path);
    totalBytes += card.bytes;
  }
  assert.ok(totalBytes <= CARDS_MAX_BYTES, `${totalBytes} bytes`);

  const examples = {
    "pkg:generic/nodejs": /class="security segment".*Maintenance from/u,
    "pkg:generic/ubuntu": /class="extended segment".*Extended to/u,
    "pkg:generic/golang": /class="prediction segment".*predicted/u,
  };
  for (const [purl, match] of Object.entries(examples)) {
    const card = index[purl]?.card;
    assert.ok(card, purl);
    assert.equal(card.path, `cards/${purl.slice(4)}.svg`);
    assert.match(await readFile(join(out, card.path), "utf8"), match);
  }
  assert.equal(index["pkg:npm/request"]?.card, undefined);

  const validate = spawnSync(
    "python3",
    [
      "-c",
      `
import pathlib, sys, xml.etree.ElementTree as ET
ns = {"s": "http://www.w3.org/2000/svg"}
files = list(pathlib.Path(sys.argv[1]).rglob("*.svg"))
assert len(files) == ${cards.length}
for file in files:
  root = ET.parse(file).getroot()
  assert root.tag == "{http://www.w3.org/2000/svg}svg", file
  assert root.attrib.get("role") == "img", file
  assert root.attrib.get("aria-labelledby") == "card-title card-desc", file
  for tag, id in [("title", "card-title"), ("desc", "card-desc")]:
    assert (node := root.find("s:" + tag, ns)) is not None and node.text and node.get("id") == id, file
  assert 0 < len(root.findall("s:g/s:title", ns)) <= ${MAX_CARD_ROWS}, file
  assert all(not element.tag.endswith(("script", "image", "foreignObject")) for element in root.iter()), file
  assert all(a.get("href", "").startswith("https://") for a in root.findall("s:a", ns)), file
`,
      join(out, "cards"),
    ],
    { encoding: "utf8" },
  );
  assert.ifError(validate.error);
  assert.equal(validate.status, 0, validate.stderr);
});
