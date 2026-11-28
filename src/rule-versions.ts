/**
 * How Ebb writes versions that are not semver as semver text, so their rules can use the `semver` VERS scheme.
 * A consumer translates what it finds with these functions before it asks whether a rule's range contains it.
 * Release-line names below also come from this module: ordering uses the VERS scheme, and the label is read
 * from a bound the scheme has already accepted.
 */

import {
  parseVers,
  parseVersLenient,
  versContains,
  versionScheme,
  type VersComparator,
  type VersConstraint,
} from "./vers.js";

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

/**
 * The release line named by a canonical VERS range.
 * A half-open step such as `>=20.0.0|<21.0.0` is `20.x`. A minor step such as `>=11.0.0|<11.1.0`
 * is `11.0`, and `>=3.11|<3.12` is `3.11`. The step is the first component that differs.
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

  const width = Math.max(lower.length, upper.length);
  const lowerParts = Array.from({ length: width }, (_, part) => lower[part] ?? 0);
  const upperParts = Array.from({ length: width }, (_, part) => upper[part] ?? 0);
  let index = -1;
  for (let part = 0; part < width; part++) {
    if (lowerParts[part] !== upperParts[part]) {
      index = part;
      break;
    }
  }
  // One release line is a step of exactly 1 on a single component, with every later component at 0.
  if (index < 0 || upperParts[index] !== (lowerParts[index] ?? 0) + 1) return undefined;
  for (let part = index + 1; part < width; part++) {
    if (lowerParts[part] !== 0 || upperParts[part] !== 0) return undefined;
  }

  if (index === 0) return { id: `${lowerParts[0]}.x`, lower: first.version, scheme: parsed.scheme };
  return {
    id: lowerParts.slice(0, index + 1).join("."),
    lower: first.version,
    scheme: parsed.scheme,
  };
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

const isLower = (comparator: VersComparator) => comparator === ">" || comparator === ">=";
const isUpper = (comparator: VersComparator) => comparator === "<" || comparator === "<=";

/**
 * Coverage requires one interval that contains the entire expected release line.
 * More complex rule expressions fail closed rather than treating separated
 * intervals or isolated versions as a continuous range.
 */
export function ruleCoversLineRange(ruleVers: string, lineVers: string): boolean {
  const line = parseVersLenient(lineVers);
  const rule = parseVersLenient(ruleVers);
  if (line.scheme !== rule.scheme) return false;
  if (rule.all) return true;
  if (line.all) return false;

  const expectedLower = line.constraints.filter((constraint) => isLower(constraint.comparator));
  const expectedUpper = line.constraints.filter((constraint) => isUpper(constraint.comparator));
  if (
    expectedLower.length > 1 ||
    expectedUpper.length > 1 ||
    expectedLower.length + expectedUpper.length !== line.constraints.length
  )
    return false;

  const ruleLower = rule.constraints.filter((constraint) => isLower(constraint.comparator));
  const ruleUpper = rule.constraints.filter((constraint) => isUpper(constraint.comparator));
  if (ruleLower.length > 1 || ruleUpper.length > 1) return false;
  if (rule.constraints.some((constraint) => constraint.comparator === "=")) return false;
  if (rule.constraints.some((constraint) => constraint.comparator === "!=" && versContains(line, constraint.version)))
    return false;

  const scheme = versionScheme(line.scheme);
  return (
    endpointCovered(ruleLower[0], expectedLower[0], scheme.compare, ">") &&
    endpointCovered(ruleUpper[0], expectedUpper[0], scheme.compare, "<")
  );
}

function endpointCovered(
  rule: VersConstraint | undefined,
  expected: VersConstraint | undefined,
  compare: (left: string, right: string) => number,
  exclusive: ">" | "<",
): boolean {
  if (!rule) return true;
  if (!expected) return false;
  const order = compare(rule.version, expected.version);
  if (order === 0) return rule.comparator !== exclusive || expected.comparator === exclusive;
  return exclusive === ">" ? order < 0 : order > 0;
}
