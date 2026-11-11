/**
 * VERS version range parsing and containment.
 * https://github.com/package-url/vers-spec
 */

import { required } from "./required.js";

export type VersComparator = "=" | "!=" | "<" | "<=" | ">" | ">=";

export interface VersConstraint {
  comparator: VersComparator;
  version: string;
}

export interface VersRange {
  scheme: string;
  /** Sorted by version. Empty when the range matches every version (`*`). */
  constraints: VersConstraint[];
  all: boolean;
}

/** Orders versions of one versioning scheme. */
export interface VersionScheme {
  /** VERS scheme names this comparator serves, for example ["npm", "semver"]. */
  readonly names: readonly string[];
  /** Negative when left < right, zero when equal, positive when left > right. Throws for invalid versions. */
  compare(left: string, right: string): number;
}

export class VersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersError";
  }
}

const schemes = new Map<string, VersionScheme>();

export function registerVersionScheme(scheme: VersionScheme): void {
  for (const name of scheme.names) schemes.set(name.toLowerCase(), scheme);
}

export function versionScheme(name: string): VersionScheme {
  const scheme = schemes.get(name.toLowerCase());
  if (!scheme) throw new VersError(`Unsupported VERS scheme "${name}".`);
  return scheme;
}

export function hasVersionScheme(name: string): boolean {
  return schemes.has(name.toLowerCase());
}

/** The spec's `intdot` scheme: dot-separated integers; anything after the first other character is ignored. */
export const intdotScheme: VersionScheme = {
  names: ["intdot"],
  compare(left, right) {
    const segments = (value: string) => {
      const prefix = /^[0-9.]*/.exec(value)?.[0] ?? "";
      if (!/^\d/.test(prefix)) throw new VersError(`Invalid intdot version "${value}".`);
      return prefix
        .split(".")
        .filter(Boolean)
        .map((segment) => BigInt(segment));
    };
    const a = segments(left);
    const b = segments(right);
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
      const difference = (a[index] ?? 0n) - (b[index] ?? 0n);
      if (difference !== 0n) return difference < 0n ? -1 : 1;
    }
    return 0;
  },
};
registerVersionScheme(intdotScheme);

const isLower = (comparator: VersComparator) => comparator === ">" || comparator === ">=";
const isUpper = (comparator: VersComparator) => comparator === "<" || comparator === "<=";

const NON_SPACE_WHITESPACE = /[^\S ]/;
const LOWERCASE_PERCENT_HEX = /%(?:[a-f][0-9A-Fa-f]|[0-9A-Fa-f][a-f])/;
const RESERVED_VERSION_CHAR = /[><=!*]/;

function parseConstraint(raw: string, canonical: boolean): VersConstraint {
  let comparator: VersComparator = "=";
  let encoded = raw;
  for (const candidate of [">=", "<=", "!=", "<", ">"] as const) {
    if (raw.startsWith(candidate)) {
      comparator = candidate;
      encoded = raw.slice(candidate.length);
      break;
    }
  }
  if (comparator === "=" && raw.startsWith("=")) {
    if (canonical) throw new VersError("non-canonical VERS: explicit equality comparator is not permitted");
    encoded = raw.replace(/^=+/, "");
  }
  if (!canonical) encoded = encoded.trimStart();
  if (!encoded) throw new VersError(`Missing version in constraint "${raw}".`);
  if (canonical && RESERVED_VERSION_CHAR.test(encoded)) {
    throw new VersError(`non-canonical VERS: unencoded reserved character in version "${raw}"`);
  }
  if (encoded.includes("*")) {
    throw new VersError(`"*" must be the only constraint: ${raw}`);
  }
  let version: string;
  try {
    version = decodeURIComponent(encoded);
  } catch {
    throw new VersError(`non-canonical VERS: invalid percent-encoding in version "${raw}"`);
  }
  if (canonical && LOWERCASE_PERCENT_HEX.test(encoded)) {
    throw new VersError(`non-canonical VERS: percent-encoding in version is not canonical "${raw}"`);
  }
  if (NON_SPACE_WHITESPACE.test(version)) {
    throw new VersError("non-canonical VERS: whitespace is not permitted");
  }
  return { comparator, version };
}

function validateSequence(constraints: readonly VersConstraint[], value: string): void {
  const withoutNotEqual = constraints.filter((constraint) => constraint.comparator !== "!=");
  for (let index = 0; index < withoutNotEqual.length - 1; index++) {
    const current = required(withoutNotEqual[index], "the constraint").comparator;
    const next = required(withoutNotEqual[index + 1], "the following constraint").comparator;
    if (current === "=" && isUpper(next)) {
      throw new VersError(`Invalid VERS: an equality constraint cannot be followed by an upper bound: ${value}`);
    }
  }
  const bounds = withoutNotEqual.filter((constraint) => constraint.comparator !== "=");
  for (let index = 0; index < bounds.length - 1; index++) {
    const current = required(bounds[index], "the bound").comparator;
    const next = required(bounds[index + 1], "the following bound").comparator;
    if ((isLower(current) && isLower(next)) || (isUpper(current) && isUpper(next))) {
      throw new VersError(`Invalid VERS: bounds must alternate between lower and upper: ${value}`);
    }
  }
}

const SCHEME_PATTERN = /^[a-z][a-z0-9.+-]*$/;

/** Applies the whitespace rule of the requested form: canonical forbids it, lenient trims outer whitespace. */
function versText(value: string, canonical: boolean): string {
  if (canonical && /\s/.test(value)) throw new VersError("non-canonical VERS: whitespace is not permitted");
  return canonical ? value : value.trim();
}

/** Splits `text` into the scheme and the raw constraint body, rejecting the malformed prefix forms. */
function splitVers(text: string, value: string, canonical: boolean): { scheme: string; body: string } {
  if (canonical ? !text.startsWith("vers:") : !/^vers:/i.test(text)) {
    throw new VersError(`VERS must start with "vers:": ${value}`);
  }
  const slash = text.indexOf("/");
  if (slash < 0) throw new VersError(`VERS is missing constraints: ${value}`);
  const rawScheme = text.slice(5, slash);
  const scheme = rawScheme.toLowerCase();
  if (!SCHEME_PATTERN.test(scheme)) throw new VersError(`Invalid VERS scheme "${rawScheme}".`);
  if (canonical && rawScheme !== scheme) {
    throw new VersError(`non-canonical VERS: scheme "${rawScheme}" must be lowercase`);
  }
  const rawBody = text.slice(slash + 1);
  const body = canonical ? rawBody : rawBody.trim();
  if (!body) throw new VersError("non-canonical VERS: constraints must not be empty");
  return { scheme, body };
}

/** Splits `body` on `|` (trimming segment whitespace in lenient mode) and rejects invalid pipe placements. */
function splitPipes(body: string, canonical: boolean): string[] {
  if (body.startsWith("|")) throw new VersError("non-canonical VERS: leading pipe is not permitted");
  if (body.endsWith("|")) throw new VersError("non-canonical VERS: trailing pipe is not permitted");
  const rawParts = body.split("|");
  const parts = canonical ? rawParts : rawParts.map((part) => part.trim());
  if (parts.some((part) => part === "")) throw new VersError("non-canonical VERS: consecutive pipes are not permitted");
  return parts;
}

/** The parsed, sorted constraints of `body`; empty for `*`. */
function parseConstraints(scheme: string, body: string, value: string, canonical: boolean): VersConstraint[] {
  if (body === "*") return [];
  const parts = splitPipes(body, canonical);
  const versionSchemeFor = versionScheme(scheme);
  if (parts.includes("*")) throw new VersError(`"*" must be the only constraint: ${value}`);
  const constraints = parts.map((part) => parseConstraint(part, canonical));

  const sorted = [...constraints].sort((left, right) => versionSchemeFor.compare(left.version, right.version));
  for (let index = 1; index < sorted.length; index++) {
    const previous = required(sorted[index - 1], "the previous constraint");
    const current = required(sorted[index], "the constraint");
    if (versionSchemeFor.compare(previous.version, current.version) === 0) {
      throw new VersError(`Invalid VERS: version "${current.version}" appears more than once: ${value}`);
    }
  }
  if (canonical && sorted.some((constraint, index) => constraint !== constraints[index])) {
    throw new VersError("non-canonical VERS: constraints are not sorted by version");
  }
  validateSequence(sorted, value);
  return sorted;
}

function parse(value: string, canonical: boolean): VersRange {
  const { scheme, body } = splitVers(versText(value, canonical), value, canonical);
  return { scheme, constraints: parseConstraints(scheme, body, value, canonical), all: body === "*" };
}

/** Parses a VERS string in canonical form, as registry rules must be written. */
export function parseVers(value: string): VersRange {
  return parse(value, true);
}

/** Parses a VERS string, tolerating whitespace, `=` comparators, and unsorted constraints. */
export function parseVersLenient(value: string): VersRange {
  return parse(value, false);
}

/**
 * Throws when any constraint version is not a valid version of the range's scheme.
 * Parsing does not validate versions (the spec allows any string); registry rules must.
 */
export function validateVersVersions(range: string | VersRange): void {
  const parsed = typeof range === "string" ? parseVers(range) : range;
  const scheme = versionScheme(parsed.scheme);
  for (const constraint of parsed.constraints) scheme.compare(constraint.version, constraint.version);
}

function encodeVersion(version: string): string {
  return encodeURIComponent(version)
    .replace(/%3A/gi, ":")
    .replace(/[!*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function formatVers(range: VersRange): string {
  const scheme = range.scheme.toLowerCase();
  if (range.all) {
    if (range.constraints.length > 0) throw new VersError('"*" must be the only constraint');
    return `vers:${scheme}/*`;
  }
  if (range.constraints.length === 0) throw new VersError("non-canonical VERS: constraints must not be empty");
  const parts = range.constraints.map(
    ({ comparator, version }) => `${comparator === "=" ? "" : comparator}${encodeVersion(version)}`,
  );
  return `vers:${scheme}/${parts.join("|")}`;
}

/** Returns the canonical form of a VERS string. */
export function normalizeVers(value: string): string {
  return formatVers(parseVersLenient(value));
}

type ConstraintComparison = (constraint: VersConstraint) => number;

/** Comparators whose own version is inside the range. */
const INCLUSIVE_COMPARATORS = new Set<VersComparator>(["=", "<=", ">="]);

/** The containment procedure's first step: a version equal to an inclusive constraint is inside. */
function matchesInclusiveConstraint(constraints: readonly VersConstraint[], compareTo: ConstraintComparison): boolean {
  return constraints.some(
    (constraint) => INCLUSIVE_COMPARATORS.has(constraint.comparator) && compareTo(constraint) === 0,
  );
}

/** A single bound contains versions on its open side only. */
function singleBoundContains(bound: VersConstraint, compareTo: ConstraintComparison): boolean {
  const order = compareTo(bound);
  return isUpper(bound.comparator) ? order < 0 : order > 0;
}

/** Whether `version` lies outside a pair of bounds or in the open gap between them. */
function boundPairContains(bounds: readonly VersConstraint[], index: number, compareTo: ConstraintComparison): boolean {
  const current = required(bounds[index], "the bound");
  const next = required(bounds[index + 1], "the following bound");
  if (index === 0 && isUpper(current.comparator) && compareTo(current) < 0) return true;
  if (index === bounds.length - 2 && isLower(next.comparator) && compareTo(next) > 0) return true;
  return isLower(current.comparator) && isUpper(next.comparator) && compareTo(current) > 0 && compareTo(next) < 0;
}

/** Whether any adjacent pair of bounds contains the version. */
function anyBoundPairContains(bounds: readonly VersConstraint[], compareTo: ConstraintComparison): boolean {
  for (let index = 0; index < bounds.length - 1; index++) {
    if (boundPairContains(bounds, index, compareTo)) return true;
  }
  return false;
}

/** Checks whether a version is inside a VERS range, following the spec's containment procedure. */
export function versContains(range: string | VersRange, version: string): boolean {
  const parsed = typeof range === "string" ? parseVersLenient(range) : range;
  if (parsed.all) return true;
  if (parsed.constraints.length === 0) throw new VersError("non-canonical VERS: constraints must not be empty");
  const scheme = versionScheme(parsed.scheme);
  const compareTo: ConstraintComparison = (constraint) => scheme.compare(version, constraint.version);

  if (matchesInclusiveConstraint(parsed.constraints, compareTo)) return true;
  if (parsed.constraints.some((constraint) => constraint.comparator === "!=" && compareTo(constraint) === 0))
    return false;

  const bounds = parsed.constraints.filter(
    (constraint) => constraint.comparator !== "=" && constraint.comparator !== "!=",
  );
  if (bounds.length === 1) return singleBoundContains(required(bounds[0], "the single bound"), compareTo);
  return anyBoundPairContains(bounds, compareTo);
}
