import assert from "node:assert/strict";
import { test } from "node:test";

import { check, orderMatches, resolveCandidateRules, type CheckResult } from "../../src/check.js";
import { BUNDLED_ECOSYSTEMS } from "../../src/data-bundle.js";
import { getActiveDataSync } from "../../src/data-source.js";
import { PurlError } from "../../src/purl.js";
import { validateRegistryV2, type RegistryV2Rule } from "../../src/registry.js";
import { parseVersLenient, VersError, versContains } from "../../src/vers.js";

/** How many random (purl, version) pairs each property run exercises. */
const ITERATIONS = 1_000;

/** Minimum non-empty match outcomes required so the suite cannot silently go all-ok. */
const MIN_NONEMPTY_MATCHES = 100;

/** How many real-rule inside/outside pairs the dedicated match-path test exercises. */
const MATCH_PATH_SAMPLES = 200;

/** Seeds whose bundled rules supply real registry purls for matching runs. */
const KNOWN_REGISTRY_PURLS = [
  "pkg:generic/nodejs",
  "pkg:npm/left-pad",
  "pkg:npm/request",
  "pkg:pypi/pycrypto",
] as const;

const PURL_TYPES = [
  "npm",
  "pypi",
  "maven",
  "cargo",
  "gem",
  "golang",
  "nuget",
  "generic",
  "deb",
  "rpm",
  "github",
  "oci",
] as const;

const NAME_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.";
const VERSION_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.+-_/";
const JUNK_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789:/@?#%&=[]{}<> \t\n\\"';

/** Tiny seeded LCG so the suite stays reproducible without a dependency. */
class Rng {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  next(): number {
    this.#state = (1664525 * this.#state + 1013904223) >>> 0;
    return this.#state / 0x100000000;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  string(alphabet: string, minLen: number, maxLen: number): string {
    const length = minLen + this.int(maxLen - minLen + 1);
    let out = "";
    for (let i = 0; i < length; i++) out += alphabet[this.int(alphabet.length)]!;
    return out;
  }
}

/** Distinct package purls drawn from the bundled rules for the known seeds. */
function registryPurls(): string[] {
  const purls = new Set<string>();
  for (const seed of KNOWN_REGISTRY_PURLS) {
    for (const rule of resolveCandidateRules(seed)) {
      purls.add(rule.purl);
    }
  }
  const list = [...purls];
  assert.ok(list.length > 0, "expected bundled rules for known registry seeds");
  return list;
}

function randomName(rng: Rng): string {
  return rng.string(NAME_CHARS, 1, 12);
}

/** A plain semver that registry ranges (semver / npm / pypi) can compare. */
function randomPlausibleSemver(rng: Rng): string {
  return `${rng.int(26)}.${rng.int(40)}.${rng.int(100)}`;
}

function randomVersionToken(rng: Rng): string {
  if (rng.bool(0.55)) {
    const major = rng.int(30);
    const minor = rng.int(40);
    const patch = rng.int(100);
    let version = `${major}.${minor}.${patch}`;
    if (rng.bool(0.2)) version += `-${rng.pick(["alpha", "beta", "rc", "dev"])}.${rng.int(5)}`;
    if (rng.bool(0.15)) version += `+${rng.string("abcdef0123456789", 2, 8)}`;
    return version;
  }
  if (rng.bool(0.5)) return rng.string(VERSION_CHARS, 1, 16);
  return rng.string(JUNK_CHARS, 0, 10);
}

/**
 * Builds a mix of plausible and broken purls. Always aims at the purl path
 * (`pkg:…`) so product-name resolution is not part of this property suite.
 */
function randomJunkPurl(rng: Rng): string {
  const kind = rng.int(10);
  if (kind === 0) return `pkg:${rng.string(JUNK_CHARS, 0, 20)}`;
  if (kind === 1) return `pkg:${rng.pick(PURL_TYPES)}`;
  if (kind === 2) return `pkg:${rng.pick(PURL_TYPES)}/`;
  if (kind === 3) return `pkg:${rng.int(9)}${randomName(rng)}/${randomName(rng)}`;

  const type = rng.pick(PURL_TYPES);
  const name = randomName(rng);
  const withNamespace = type === "maven" || type === "golang" || type === "github" || rng.bool(0.35);
  const namespace = withNamespace ? `${randomName(rng)}${rng.bool(0.3) ? `.${randomName(rng)}` : ""}` : "";
  let purl = namespace ? `pkg:${type}/${namespace}/${name}` : `pkg:${type}/${name}`;

  if (rng.bool(0.25)) purl += `@${randomVersionToken(rng)}`;
  if (rng.bool(0.15)) {
    const key = rng.bool(0.7) ? rng.string("abcdefghijklmnopqrstuvwxyz", 1, 6) : rng.string("ABCDEF", 1, 4);
    purl += `?${key}=${rng.string(NAME_CHARS, 1, 8)}`;
  }
  if (rng.bool(0.1)) purl += `#${rng.string(NAME_CHARS, 1, 8)}`;
  // Case only — `pkg%3A…` is not a purl prefix for `check` (it takes the product-name path).
  if (rng.bool(0.08)) purl = purl.replace("pkg:", rng.pick(["PKG:", "Pkg:", "pKg:"]));
  return purl;
}

function randomJunkVersion(rng: Rng): string {
  const token = randomVersionToken(rng);
  let version = token;
  if (rng.bool(0.25) && token.length > 0) version = `v${token}`;
  if (rng.bool(0.15)) version = ` ${version} `;
  if (rng.bool(0.05)) version = "";
  return version;
}

type GeneratedInput = {
  purl: string;
  version: string;
  /** True when the purl came from bundled rules and the version is a plain semver. */
  fromRegistry: boolean;
};

/** About 40% registry purls with a plausible semver; the rest stay random/junk. */
function randomInput(rng: Rng, registry: readonly string[]): GeneratedInput {
  if (rng.bool(0.4)) {
    return {
      purl: rng.pick(registry),
      version: randomPlausibleSemver(rng),
      fromRegistry: true,
    };
  }
  return {
    purl: randomJunkPurl(rng),
    version: randomJunkVersion(rng),
    fromRegistry: false,
  };
}

type Outcome =
  | { kind: "result"; value: CheckResult }
  | { kind: "purl"; error: PurlError }
  | { kind: "vers"; error: VersError };

function runCheck(purl: string, version: string): Outcome {
  try {
    return { kind: "result", value: check(purl, version) };
  } catch (error) {
    if (error instanceof PurlError) return { kind: "purl", error };
    if (error instanceof VersError) return { kind: "vers", error };
    throw error;
  }
}

function assertSameVerdict(left: CheckResult, right: CheckResult, versionLabel: string): void {
  assert.equal(left.status, right.status, `status mismatch for ${versionLabel}`);
  assert.deepEqual(left.matches, right.matches, `matches mismatch for ${versionLabel}`);
}

/** Ordering, status, and v-prefix stability for a successful non-empty match list. */
function assertMatchProperties(purl: string, version: string, result: CheckResult): void {
  assert.ok(result.matches.length > 0);
  assert.deepEqual(
    result.matches,
    orderMatches([...result.matches]),
    `matches must be ordered by event severity then date for ${purl}@${version}`,
  );
  assert.equal(
    result.status,
    result.matches[0]!.event,
    `status must equal the most serious match event for ${purl}@${version}`,
  );

  const prefixed = runCheck(purl, `v${version}`);
  assert.equal(prefixed.kind, "result", `v-prefixed version must succeed for ${purl}@${version}`);
  if (prefixed.kind === "result") {
    assertSameVerdict(result, prefixed.value, `v${version}`);
    assert.equal(prefixed.value.version, `v${version}`);
  }
}

test("check returns a result or a typed purl/vers error for 1000 random inputs", () => {
  const rng = new Rng(0x45_c4_ec_45);
  const registry = registryPurls();
  let nonemptyMatches = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const { purl, version, fromRegistry } = randomInput(rng, registry);
    const outcome = runCheck(purl, version);
    if (outcome.kind === "result") {
      assert.equal(typeof outcome.value.status, "string");
      assert.ok(Array.isArray(outcome.value.matches));
      assert.equal(outcome.value.version, version);
      if (outcome.value.matches.length > 0) {
        nonemptyMatches += 1;
        if (fromRegistry) assertMatchProperties(purl, version, outcome.value);
      }
    } else {
      assert.ok(outcome.error instanceof Error);
      assert.ok(outcome.error.message.length > 0);
    }
  }

  assert.ok(
    nonemptyMatches >= MIN_NONEMPTY_MATCHES,
    `expected at least ${MIN_NONEMPTY_MATCHES} non-empty match lists, got ${nonemptyMatches}`,
  );
});

test("check is deterministic and matches the v-prefixed version", () => {
  const rng = new Rng(0x7e57_5eed);
  const registry = registryPurls();

  for (let i = 0; i < ITERATIONS; i++) {
    const { purl, version: rawVersion, fromRegistry } = randomInput(rng, registry);
    // Base version without a leading v so the prefix comparison is meaningful.
    let baseVersion = rawVersion.trim();
    if (baseVersion.startsWith("v") || baseVersion.startsWith("V")) baseVersion = baseVersion.slice(1);
    if (!baseVersion.trim()) baseVersion = randomPlausibleSemver(rng);

    const first = runCheck(purl, baseVersion);
    const second = runCheck(purl, baseVersion);

    assert.equal(first.kind, second.kind, `outcome kind drifted for ${purl}@${baseVersion}`);
    if (first.kind === "result" && second.kind === "result") {
      assert.deepEqual(first.value, second.value);
      assert.equal(first.value.version, baseVersion);

      const prefixed = runCheck(purl, `v${baseVersion}`);
      if (prefixed.kind === "result") {
        assertSameVerdict(first.value, prefixed.value, `v${baseVersion}`);
        assert.equal(prefixed.value.version, `v${baseVersion}`);
      } else {
        assert.fail(`plain version succeeded but v-prefixed threw ${prefixed.error.name}: ${prefixed.error.message}`);
      }

      if (fromRegistry && first.value.matches.length > 0) {
        assertMatchProperties(purl, baseVersion, first.value);
      }
    } else if (first.kind !== "result" && second.kind !== "result") {
      assert.equal(first.error.name, second.error.name);
      assert.equal(first.error.message, second.error.message);
    }
  }
});

/** Version-level rules from the active data (same set `check` indexes). */
function activeVersionRules(): RegistryV2Rule[] {
  const data = getActiveDataSync();
  const rules: RegistryV2Rule[] = [];
  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    rules.push(...validateRegistryV2(data.readSync(`registry/${ecosystem}.json`)).rules);
  }
  return rules.filter((rule) => rule.usage === undefined || rule.usage.some((matcher) => matcher.kind !== "symbol"));
}

/** Nearby spellings of a constraint version so we can find both sides of a bounded range. */
function relatedVersions(version: string): string[] {
  const out = new Set<string>([version, "0", "0.0.0", "1.0.0", "99999.0.0"]);
  const parts = version.split(".");
  const last = parts[parts.length - 1]!;
  const lastNum = /^(\d+)/.exec(last);
  if (lastNum) {
    const n = Number(lastNum[1]);
    const suffix = last.slice(lastNum[0].length);
    const head = parts.slice(0, -1);
    out.add([...head, `${n + 1}${suffix}`].join("."));
    if (n > 0) out.add([...head, `${n - 1}${suffix}`].join("."));
    out.add([...parts, "0"].join("."));
  }
  const firstNum = /^(\d+)/.exec(parts[0]!);
  if (firstNum) {
    const n = Number(firstNum[1]);
    const rest = parts.slice(1);
    out.add([`${n + 1}`, ...rest].join("."));
    if (n > 0) out.add([`${n - 1}`, ...rest].join("."));
  }
  return [...out];
}

/** One version the rule's range contains and one it does not, or undefined when none exist. */
function versionsAroundRule(rule: RegistryV2Rule): { inside: string; outside: string } | undefined {
  const range = parseVersLenient(rule.vers);
  if (range.all) return undefined;

  const candidates = new Set<string>();
  for (const constraint of range.constraints) {
    for (const version of relatedVersions(constraint.version)) candidates.add(version);
  }

  let inside: string | undefined;
  let outside: string | undefined;
  for (const version of candidates) {
    try {
      if (versContains(rule.vers, version)) inside ??= version;
      else outside ??= version;
    } catch {
      // Candidate is not a valid version for this scheme.
    }
    if (inside !== undefined && outside !== undefined) return { inside, outside };
  }
  return undefined;
}

test("check matches a version inside a real rule and misses one outside it", () => {
  const rng = new Rng(0x1a4c_7e57);
  const usable = activeVersionRules().flatMap((rule) => {
    const pair = versionsAroundRule(rule);
    return pair === undefined ? [] : [{ rule, ...pair }];
  });
  assert.ok(
    usable.length >= MATCH_PATH_SAMPLES,
    `expected at least ${MATCH_PATH_SAMPLES} bounded active rules with inside/outside versions, got ${usable.length}`,
  );

  for (let i = 0; i < MATCH_PATH_SAMPLES; i++) {
    const sample = rng.pick(usable);
    const inside = check(sample.rule.purl, sample.inside);
    assert.notEqual(inside.status, "ok", `${sample.rule.id} should match ${sample.inside}`);
    assert.ok(
      inside.matches.some((match) => match.ruleId === sample.rule.id),
      `${sample.rule.id} missing from matches for ${sample.rule.purl}@${sample.inside}`,
    );

    const outside = check(sample.rule.purl, sample.outside);
    assert.equal(
      outside.matches.some((match) => match.ruleId === sample.rule.id),
      false,
      `${sample.rule.id} must not match ${sample.outside}`,
    );
  }
});
