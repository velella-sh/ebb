import { formatVers, parseVers, validateVersVersions, type VersConstraint, versionScheme } from "../../src/vers.js";

type Scheme = "semver" | "pypi";
type Bound = { version: string; inclusive: boolean };
type Interval = { lower?: Bound | undefined; upper?: Bound | undefined };

function intersection(scheme: Scheme, a: Interval, b: Interval): Interval | undefined {
  const compare = versionScheme(scheme).compare;
  const lowerOrder = a.lower && b.lower ? compare(a.lower.version, b.lower.version) : 0;
  const upperOrder = a.upper && b.upper ? compare(a.upper.version, b.upper.version) : 0;
  const lower = !a.lower || lowerOrder < 0 || (lowerOrder === 0 && b.lower && !b.lower.inclusive) ? b.lower : a.lower;
  const upper = !a.upper || upperOrder > 0 || (upperOrder === 0 && b.upper && !b.upper.inclusive) ? b.upper : a.upper;
  if (lower && upper) {
    const order = compare(lower.version, upper.version);
    if (order > 0 || (order === 0 && !(lower.inclusive && upper.inclusive))) return undefined;
  }
  return { lower, upper };
}

/** Serialize the union as disjoint intervals in canonical VERS order. */
function unionVers(scheme: Scheme, input: Interval[]): string {
  const compare = versionScheme(scheme).compare;
  const sorted = input.sort((a, b) => {
    if (!a.lower || !b.lower) return Number(Boolean(a.lower)) - Number(Boolean(b.lower));
    return compare(a.lower.version, b.lower.version) || Number(b.lower.inclusive) - Number(a.lower.inclusive);
  });
  const intervals: Interval[] = [];
  const exclusions: VersConstraint[] = [];
  for (const next of sorted) {
    const prev = intervals.at(-1);
    if (!prev) {
      intervals.push(next);
      continue;
    }
    const order = prev.upper && next.lower ? compare(prev.upper.version, next.lower.version) : 1;
    if (order < 0) {
      intervals.push(next);
      continue;
    }
    if (order === 0 && prev.upper && next.lower && !(prev.upper.inclusive || next.lower.inclusive)) {
      exclusions.push({ comparator: "!=", version: prev.upper.version });
    }
    if (!prev.upper || !next.upper) prev.upper = undefined;
    else {
      const upperOrder = compare(prev.upper.version, next.upper.version);
      if (upperOrder < 0 || (upperOrder === 0 && next.upper.inclusive)) prev.upper = next.upper;
    }
  }
  if (!intervals.length) throw new Error("range has no compatible versions");

  const constraints: VersConstraint[] = [...exclusions];
  for (const { lower, upper } of intervals) {
    if (lower && upper && compare(lower.version, upper.version) === 0) {
      constraints.push({ comparator: "=", version: lower.version });
      continue;
    }
    if (lower) constraints.push({ comparator: lower.inclusive ? ">=" : ">", version: lower.version });
    if (upper) constraints.push({ comparator: upper.inclusive ? "<=" : "<", version: upper.version });
  }
  constraints.sort((a, b) => compare(a.version, b.version));
  const vers = formatVers({ scheme, all: !constraints.length, constraints });
  validateVersVersions(parseVers(vers));
  return vers;
}

function compareInterval(operator: string, version: string): Interval {
  if (operator === ">" || operator === ">=") return { lower: { version, inclusive: operator === ">=" } };
  if (operator === "<" || operator === "<=") return { upper: { version, inclusive: operator === "<=" } };
  return { lower: { version, inclusive: true }, upper: { version, inclusive: true } };
}

interface NodeRelease {
  parts: readonly bigint[];
  version: string;
  prerelease: boolean;
}

function parseNodeRelease(text: string): NodeRelease {
  const match =
    /^v?([0-9]+|[xX*])(?:\.([0-9]+|[xX*]))?(?:\.([0-9]+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      text,
    );
  if (!match) throw new Error("unsupported npm version");
  const [, major, minor, patch, prerelease] = match;
  const parts: bigint[] = [];
  for (const part of [major, minor, patch]) {
    if (!part || !/^\d+$/.test(part)) break;
    if (/^0\d/.test(part)) throw new Error("invalid npm version");
    parts.push(BigInt(part));
  }
  if (prerelease && parts.length !== 3) throw new Error("invalid npm prerelease");
  const version = [parts[0] ?? 0n, parts[1] ?? 0n, parts[2] ?? 0n].join(".");
  return { parts, version, prerelease: Boolean(prerelease) };
}

function nodeUpper(release: NodeRelease, index: number): string {
  const parts = release.parts.slice(0, index + 1);
  parts[index] = (parts[index] ?? 0n) + 1n;
  return [parts[0] ?? 0n, parts[1] ?? 0n, parts[2] ?? 0n].join(".");
}

function nodeConstraint(operator: string, release: NodeRelease): Interval | undefined {
  const { parts, prerelease, version } = release;
  if (!parts.length) return operator === "<" || operator === ">" ? undefined : {};
  const lower = { version, inclusive: true };
  if (operator === "~" || operator === "~>") {
    return { lower, upper: { version: nodeUpper(release, Math.min(parts.length - 1, 1)), inclusive: false } };
  }
  if (operator === "^") {
    const firstNonZero = parts.findIndex((part) => part > 0n);
    const bump = firstNonZero === -1 ? parts.length - 1 : firstNonZero;
    return { lower, upper: { version: nodeUpper(release, bump), inclusive: false } };
  }
  if (parts.length < 3) {
    const upper = { version: nodeUpper(release, parts.length - 1), inclusive: false };
    if (operator === ">") return { lower: { ...upper, inclusive: true } };
    if (operator === ">=") return { lower };
    if (operator === "<") return { upper: { ...lower, inclusive: false } };
    if (operator === "<=") return { upper };
    return { lower, upper };
  }
  if (prerelease) {
    if (operator === ">" || operator === ">=") return { lower };
    if (operator === "<" || operator === "<=") return { upper: { ...lower, inclusive: false } };
    return undefined;
  }
  return compareInterval(operator, version);
}

function npmArm(arm: string): Interval | undefined {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(arm);
  if (hyphen) {
    const lower = nodeConstraint(">=", parseNodeRelease(hyphen[1]!));
    const upper = nodeConstraint("<=", parseNodeRelease(hyphen[2]!));
    return lower && upper ? intersection("semver", lower, upper) : undefined;
  }
  const text = arm.replace(/([<>]=?|=|~>?|\^)\s+/g, "$1");
  let interval: Interval | undefined = {};
  for (const token of text ? text.split(/\s+/) : []) {
    const [, operator, value] = /^(>=|<=|>|<|=|~>|~|\^)?(.+)$/.exec(token)!;
    const bound = nodeConstraint(operator ?? "", parseNodeRelease(value!));
    interval = interval && bound ? intersection("semver", interval, bound) : undefined;
  }
  return interval;
}

/** Native npm ranges evaluated against stable Node releases. */
export function nodeEnginesVers(raw: string): string {
  const arms = raw.split("||").map((arm) => npmArm(arm.trim()));
  return unionVers(
    "semver",
    arms.filter((arm): arm is Interval => arm !== undefined),
  );
}

function nextPrefix(prefix: string): string {
  const components = prefix.split(".");
  const [last] = components.splice(-1);
  return [...components, String(BigInt(last!) + 1n)].join(".");
}

/** PEP 440 specifiers evaluated against stable Python releases. */
export function requiresPythonVers(raw: string): string {
  let arms: Interval[] = [{}];
  for (const specifier of raw.replace(/^\s*\((.*)\)\s*$/, "$1").split(",")) {
    const part = /^(~=|==|!=|>=|<=|>|<)\s*(\d+(?:\.\d+)*)(\.\*)?$/.exec(specifier.trim());
    if (!part) throw new Error("unsupported Requires-Python specifier");
    const [, operator, version, wildcard] = part;
    if (wildcard && operator !== "==" && operator !== "!=") throw new Error("invalid Requires-Python wildcard");
    const span: Interval = wildcard
      ? { lower: { version: version!, inclusive: true }, upper: { version: nextPrefix(version!), inclusive: false } }
      : compareInterval(operator!, version!);
    const options =
      operator === "!="
        ? [
            { upper: { version: span.lower!.version, inclusive: false } },
            { lower: { version: span.upper!.version, inclusive: !span.upper!.inclusive } },
          ]
        : operator === "~="
          ? [
              {
                lower: { version: version!, inclusive: true },
                upper: { version: nextPrefix(version!.split(".").slice(0, -1).join(".")), inclusive: false },
              },
            ]
          : [span];
    arms = arms.flatMap((arm) =>
      options.flatMap((option) => {
        const overlap = intersection("pypi", arm, option);
        return overlap ? [overlap] : [];
      }),
    );
  }
  return unionVers("pypi", arms);
}
