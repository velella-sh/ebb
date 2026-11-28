import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { resolveAllRulesForIdentity, resolveCandidateRules } from "../src/check-core.js";
import { DATA_SIGNER } from "../src/data-bundle.js";
import { asOf, check } from "../src/index.js";
import { lifecycleEventPrecedence, type RegistryV2Rule } from "../src/registry.js";

const spec = "docs/spec/1.0";
const [rule, events, evidence, matching, distribution] = await Promise.all(
  ["rule", "events", "evidence", "matching", "distribution"].map((name) => readFile(join(spec, name + ".md"), "utf8")),
);
const schema = JSON.parse(await readFile("schemas/rule.v2.schema.json", "utf8"));
const validate = new Ajv2020({ allErrors: true }).compile<RegistryV2Rule>(schema);
const registries = await Promise.all(
  (await readdir("registry"))
    .filter((name) => name.endsWith(".json"))
    .map(async (name) => JSON.parse(await readFile(join("registry", name), "utf8")) as { rules?: RegistryV2Rule[] }),
);
const stored = new Map(registries.flatMap(({ rules }) => rules ?? []).map((rule) => [rule.id, rule]));

function examples<T>(page: string): T[] {
  return [...page.matchAll(/\x60{3}json\r?\n([\s\S]*?)\r?\n\x60{3}/gu)].map((block) => JSON.parse(block[1]!) as T);
}

test("the draft names all rule v2 properties and documents a complete current registry record", () => {
  const declared = [...rule!.matchAll(/^\| `([a-zA-Z]+)`\s*\|/gmu)].map((entry) => entry[1]!);
  assert.deepEqual(declared.sort(), Object.keys(schema.properties).sort());
  const [completeRule, migration] = examples<unknown>(rule!);
  assert.ok(validate(completeRule), JSON.stringify(validate.errors));
  const actual = stored.get(completeRule.id);
  assert.ok(actual);
  for (const [name, value] of Object.entries(completeRule)) {
    assert.deepEqual(value, Object.getOwnPropertyDescriptor(actual, name)?.value);
  }

  assert.ok(validate({ ...completeRule, migration }), JSON.stringify(validate.errors));
  assert.equal(validate({ ...completeRule, sources: [] }), false);
  for (const storedRule of stored.values()) {
    assert.ok(validate(storedRule), `${storedRule.id}: ${JSON.stringify(validate.errors)}`);
  }
});

test("the event chapter describes every event with a registry-backed date and current wire precedence", () => {
  const [sample] = examples<Array<{ id: string; event: string; deadline: string }>>(events!);
  assert.ok(sample);
  assert.deepEqual(sample.map(({ event }) => event).sort(), [...schema.properties.event.enum].sort());
  for (const { id, event, deadline } of sample) {
    const source = stored.get(id);
    assert.equal(source?.event, event, id);
    assert.equal(source?.deadline, deadline, id);
  }
  assert.deepEqual(
    [...events!.matchAll(/^\d+\. `([^\x60]+)`$/gmu)].map((entry) => entry[1]),
    lifecycleEventPrecedence,
  );
  assert.deepEqual(examples(evidence!), [stored.get("nodejs.runtime.eol-20")?.sources[0]]);
});

interface Vector {
  requirement: string;
  purl: string;
  version: string;
  kind: string;
  status?: string;
  asOf?: string;
}

test("matching examples agree with Ebb's range, coverage and historical-result contracts", () => {
  const [vectors] = examples<Vector[]>(matching!);
  assert.ok(vectors);
  for (const { requirement, purl, version, kind, status, asOf: date } of vectors) {
    assert.ok(matching!.includes(`### ${requirement}\n`));
    if (kind === "invalid-version") {
      assert.throws(() => check(purl, version), { code: "invalid-version" });
      continue;
    }
    const candidateRules = resolveCandidateRules(purl);
    if (kind === "unknown") assert.equal(candidateRules.length, 0);
    if (kind === "no-match") assert.ok(candidateRules.length > 0);
    const result = date && kind !== "snapshot" ? asOf(date).check(purl, version) : check(purl, version, date);
    assert.equal(result.status, status, `${requirement}: ${purl}@${version}`);
    if (kind === "affected") assert.ok(result.matches.length > 0);
    if (kind === "unknown" || kind === "no-match" || kind === "unknown-at-date") {
      assert.equal(result.matches.length, 0);
    }
    if (kind === "unknown-at-date") assert.ok(candidateRules.length > 0);
  }
  const key = "python.symbol.datetime.utcnow";
  assert.ok(resolveAllRulesForIdentity("pkg:generic/python").some(({ id }) => id === key));
  assert.ok(!resolveCandidateRules("pkg:generic/python").some(({ id }) => id === key));
  assert.equal(stored.get("nodejs.runtime.eol-22")?.event, "scheduled-end-of-life");
});

test("the signer in the standalone guide is the one enforced by the verifier", () => {
  assert.ok(distribution!.includes(`--certificate-oidc-issuer ${DATA_SIGNER.issuer}`));
  assert.ok(distribution!.includes(`--certificate-identity-regexp '${DATA_SIGNER.identityPattern}'`));
});

test("draft conformance requirement identifiers are unique and have stable fragment targets", async () => {
  const chapters = await Promise.all(
    (await readdir(spec))
      .filter((name) => name.endsWith(".md"))
      .map(async (name) => [name, await readFile(join(spec, name), "utf8")] as const),
  );
  const ids = new Map<string, string>();
  for (const [filename, page] of chapters) {
    assert.match(page, /^permalink: \/spec\/1\.0\//mu);
    for (const heading of page.matchAll(/^### (ELF-[A-Z]+-\d+)$/gmu)) {
      const id = heading[1]!;
      assert.ok(!ids.has(id), `Duplicate requirement ${id}`);
      ids.set(id, filename);
    }
  }
  assert.ok(ids.size >= 25);
  for (const [, page] of chapters) {
    for (const target of page.matchAll(/\(([a-z-]+\.md)#(elf-[a-z]+-\d+)\)/gu)) {
      assert.equal(ids.get(target[2]!.toUpperCase()), target[1]);
    }
  }
});
