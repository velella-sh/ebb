import type { VersionScheme } from "../vers.js";
import { VersError } from "./errors.js";

const MAX_LENGTH = 256;

interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly (bigint | string)[];
}

function parseCoreNumber(raw: string, strict: boolean): number | null {
  if (strict ? !/^(?:0|[1-9]\d*)$/.test(raw) : !/^\d+$/.test(raw)) return null;
  const num = Number(raw);
  return Number.isSafeInteger(num) ? num : null;
}

function parsePrerelease(raw: string, strict: boolean, hadHyphen: boolean): readonly (bigint | string)[] | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (!strict && !hadHyphen) {
    // Without a hyphen (e.g. "1.2.3alpha1"), the first segment cannot start with digits or ".".
    const first = parts[0] ?? "";
    const firstPattern = raw.startsWith("-") ? /^[A-Za-z-][0-9A-Za-z-]*$/ : /^[A-Za-z][0-9A-Za-z-]*$/;
    if (!firstPattern.test(first)) return null;
  }
  const out: (bigint | string)[] = [];
  for (const part of parts) {
    if (!/^[0-9A-Za-z-]+$/.test(part)) return null;
    if (/^\d+$/.test(part)) {
      if (strict && part.length > 1 && part.startsWith("0")) return null;
      out.push(BigInt(part));
    } else {
      out.push(part);
    }
  }
  return out;
}

function parseSemverParts(value: string, strict: boolean): ParsedSemver | null {
  if (value.length > MAX_LENGTH) return null;
  let rest = value.trim();
  if (strict) {
    if (rest.startsWith("v")) rest = rest.slice(1);
  } else {
    rest = rest.replace(/^[v=\s]+/, "");
  }

  const plus = rest.indexOf("+");
  if (plus !== -1) {
    const build = rest.slice(plus + 1);
    if (!build || !build.split(".").every((part) => /^[0-9A-Za-z-]+$/.test(part))) return null;
    rest = rest.slice(0, plus);
  }

  const match = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(rest);
  if (!match) return null;
  const major = parseCoreNumber(match[1] ?? "", strict);
  const minor = parseCoreNumber(match[2] ?? "", strict);
  const patch = parseCoreNumber(match[3] ?? "", strict);
  if (major === null || minor === null || patch === null) return null;

  const tail = match[4] ?? "";
  if (tail === "") return { major, minor, patch, prerelease: [] };

  let prerelease: readonly (bigint | string)[] | null;
  if (strict) {
    if (!tail.startsWith("-")) return null;
    prerelease = parsePrerelease(tail.slice(1), true, true);
  } else if (tail.startsWith("-") && tail.length > 1 && tail[1] !== ".") {
    prerelease = parsePrerelease(tail.slice(1), false, true);
  } else {
    prerelease = parsePrerelease(tail, false, false);
  }
  if (!prerelease) return null;
  return { major, minor, patch, prerelease };
}

function compareIdentifiers(left: bigint | string, right: bigint | string): number {
  if (left === right) return 0;
  const leftNum = typeof left === "bigint";
  const rightNum = typeof right === "bigint";
  if (leftNum && rightNum) return left < right ? -1 : 1;
  if (leftNum) return -1;
  if (rightNum) return 1;
  return left < right ? -1 : 1;
}

function compareParsed(left: ParsedSemver, right: ParsedSemver): number {
  if (left.major !== right.major) return left.major < right.major ? -1 : 1;
  if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1;
  if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1;

  const aPre = left.prerelease;
  const bPre = right.prerelease;
  if (aPre.length === 0 && bPre.length === 0) return 0;
  if (aPre.length === 0) return 1;
  if (bPre.length === 0) return -1;

  const limit = Math.max(aPre.length, bPre.length);
  for (let index = 0; index < limit; index++) {
    const a = aPre[index];
    const b = bPre[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const order = compareIdentifiers(a, b);
    if (order !== 0) return order;
  }
  return 0;
}

function parseForScheme(value: string): ParsedSemver {
  const parsed = parseSemverParts(value, false);
  if (parsed) return parsed;
  // Composer and Go-style short versions: 1, 1.2, v1.2 (optionally with a pre-release).
  const short = /^v?(\d+)(?:\.(\d+))?(-[0-9A-Za-z.-]+)?$/.exec(value);
  const padded = short ? parseSemverParts(`${short[1]}.${short[2] ?? "0"}.0${short[3] ?? ""}`, false) : null;
  if (padded) return padded;
  throw new VersError(`Invalid semver version "${value}".`);
}

function parseStrict(value: string): ParsedSemver {
  const parsed = parseSemverParts(value, true);
  if (!parsed) throw new VersError(`Invalid semver version "${value}".`);
  return parsed;
}

/** @internal Validates strict SemVer 2.0.0 syntax (without importing `semver`). */
export function isValidStrictSemver(value: string): boolean {
  return parseSemverParts(value, true) !== null;
}

/** @internal Compares two strict SemVer 2.0.0 versions; build metadata does not affect precedence. */
export function compareStrictSemver(left: string, right: string): number {
  return compareParsed(parseStrict(left), parseStrict(right));
}

/**
 * Semantic Versioning 2.0 ordering for npm, cargo, golang, composer, and generic semver ranges. Build metadata is ignored.
 * @deprecated Import from `@velella/ebb` instead; subpath imports will be removed in 1.0.
 */
export const semverScheme: VersionScheme = {
  names: ["semver", "npm", "cargo", "golang", "composer"],
  compare(left, right) {
    return compareParsed(parseForScheme(left), parseForScheme(right));
  },
};
