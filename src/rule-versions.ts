/**
 * How Ebb writes versions that are not semver as semver text, so their rules can use the `semver` VERS scheme.
 * A consumer translates what it finds with these functions before it asks whether a rule's range contains it.
 * Release-line names below also come from this module: ordering uses the VERS scheme, and the label is read
 * from a bound the scheme has already accepted.
 */

import { parseVers, versionScheme } from "./vers.js";

/** A VERS range that covers exactly one release line, or every version (`*`). */
export interface ReleaseLineBounds {
  /** `20.x`, `3.11`, `1.22`, or `*` when the range is every version. */
  readonly id: string;
  /** Lower bound the scheme compared, or `*` for every version. */
  readonly lower: string;
  readonly scheme: string;
}

const STABLE_NUMBERS = /^\d+(?:\.\d+)*$/;

function numericParts(version: string): number[] | undefined {
  if (!STABLE_NUMBERS.test(version)) return undefined;
  return version.split(".").map((part) => Number(part));
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  const width = Math.max(left.length, right.length);
  for (let index = 0; index < width; index++) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return false;
  }
  return true;
}

/**
 * The release line named by a canonical VERS range.
 * A half-open step such as `>=20.0.0|<21.0.0` is `20.x`. A minor step such as `>=3.11|<3.12` is `3.11`.
 * `*` is one line covering every version. Anything else (an open range, a list of versions, a span of
 * several lines) is not a single release line.
 */
export function releaseLineFromVers(vers: string): ReleaseLineBounds | undefined {
  const parsed = parseVers(vers);
  if (parsed.all) return { id: "*", lower: "*", scheme: parsed.scheme };
  if (parsed.constraints.length !== 2) return undefined;

  const [first, second] = parsed.constraints;
  if (!first || !second) return undefined;
  if (first.comparator !== ">=" || second.comparator !== "<") return undefined;

  const scheme = versionScheme(parsed.scheme);
  if (scheme.compare(first.version, second.version) >= 0) return undefined;

  const lower = numericParts(first.version);
  const upper = numericParts(second.version);
  if (!lower || !upper) return undefined;

  let index = lower.length - 1;
  while (index > 0 && lower[index] === 0) index--;

  const width = Math.max(lower.length, upper.length);
  const expected = Array.from({ length: width }, (_, part) => lower[part] ?? 0);
  expected[index] = (expected[index] ?? 0) + 1;
  for (let part = index + 1; part < expected.length; part++) expected[part] = 0;
  const actual = Array.from({ length: width }, (_, part) => upper[part] ?? 0);
  if (!sameNumbers(expected, actual)) return undefined;

  if (index === 0) return { id: `${lower[0]}.x`, lower: first.version, scheme: parsed.scheme };
  return { id: lower.slice(0, index + 1).join("."), lower: first.version, scheme: parsed.scheme };
}

const KUBERNETES_API_VERSION = /^v([1-9]\d{0,5})(?:(alpha|beta)([1-9]\d{0,5}))?$/;

/**
 * The rule version text for a Kubernetes API version: `v1` is `1.0.0`, `v1beta2` is `1.0.0-beta.2` and `v2alpha1`
 * is `2.0.0-alpha.1`. That keeps Kubernetes' maturity order (alpha, then beta, then stable) without a new VERS
 * scheme. Undefined when `version` is not a Kubernetes API version.
 * @deprecated Import from `@velella/ebb` instead; subpath imports will be removed in 1.0.
 */
export function kubernetesRuleVersion(version: string): string | undefined {
  const match = KUBERNETES_API_VERSION.exec(version);
  if (!match) return undefined;
  const [, major, stage, number] = match;
  return stage ? `${major}.0.0-${stage}.${number}` : `${major}.0.0`;
}

/** The rule version text for a JDK feature release: `22` is `22.0.0`. */
export function jdkRuleVersion(major: number): string {
  return `${major}.0.0`;
}
