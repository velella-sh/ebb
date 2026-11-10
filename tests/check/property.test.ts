import assert from "node:assert/strict";
import { test } from "node:test";

import { check, type CheckResult } from "../../src/check.js";
import { PurlError } from "../../src/purl.js";
import { VersError } from "../../src/vers.js";

/** How many random (purl, version) pairs each property run exercises. */
const ITERATIONS = 1_000;

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

function randomName(rng: Rng): string {
  return rng.string(NAME_CHARS, 1, 12);
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
function randomPurl(rng: Rng): string {
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

function randomVersionInput(rng: Rng): string {
  const token = randomVersionToken(rng);
  let version = token;
  if (rng.bool(0.25) && token.length > 0) version = `v${token}`;
  if (rng.bool(0.15)) version = ` ${version} `;
  if (rng.bool(0.05)) version = "";
  return version;
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

test("check returns a result or a typed purl/vers error for 1000 random inputs", () => {
  const rng = new Rng(0x45_c4_ec_45);
  for (let i = 0; i < ITERATIONS; i++) {
    const purl = randomPurl(rng);
    const version = randomVersionInput(rng);
    const outcome = runCheck(purl, version);
    if (outcome.kind === "result") {
      assert.equal(typeof outcome.value.status, "string");
      assert.ok(Array.isArray(outcome.value.matches));
      assert.equal(outcome.value.version, version);
    } else {
      assert.ok(outcome.error instanceof Error);
      assert.ok(outcome.error.message.length > 0);
    }
  }
});

test("check is deterministic and matches the v-prefixed version", () => {
  const rng = new Rng(0x7e57_5eed);
  for (let i = 0; i < ITERATIONS; i++) {
    const purl = randomPurl(rng);
    // Base version without a leading v so the prefix comparison is meaningful.
    let baseVersion = randomVersionToken(rng);
    if (baseVersion.startsWith("v") || baseVersion.startsWith("V")) baseVersion = baseVersion.slice(1);
    if (!baseVersion.trim()) baseVersion = `${rng.int(20)}.${rng.int(20)}.${rng.int(20)}`;

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
    } else if (first.kind !== "result" && second.kind !== "result") {
      assert.equal(first.error.name, second.error.name);
      assert.equal(first.error.message, second.error.message);
    }
  }
});
