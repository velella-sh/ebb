/**
 * `replacementFor(purl, version)`: the suggested replacement for a matched component version.
 */

import { check, resolveCandidateRules } from "./check-core.js";
import { normalizePurl, parsePurl } from "./purl.js";

const NPM_PACKAGE_PATTERN = /^(?:@[a-z0-9-~][a-z0-9._~-]*\/)?[a-z0-9-~][a-z0-9._~-]*(?:@[A-Za-z0-9._+-]+)?$/;
const PYPI_PACKAGE_PATTERN = /^(?=.*[a-z])[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAVEN_COORDINATE_PATTERN = /^([A-Za-z0-9._-]+):([A-Za-z0-9._-]+)(?::([A-Za-z0-9._+-]+))?$/;
const NUGET_PACKAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const GOLANG_MODULE_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}(?:\/[A-Za-z0-9._~-]+)+$/;
const COMPOSER_PACKAGE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const CARGO_CRATE_PATTERN = /^[a-z][a-z0-9_-]*$/;
const UNDERSCORE_LOWERCASE_PACKAGE_PATTERN = /^[a-z][a-z0-9_]*$/;
const GEM_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

function buildPackagePurl(componentType: string | undefined, value: string): string | null {
  if (!componentType || /\s/.test(value) || value.includes("://") || value.includes("(") || value.includes(")")) {
    return null;
  }

  switch (componentType) {
    case "npm":
      return NPM_PACKAGE_PATTERN.test(value) ? `pkg:npm/${value}` : null;
    case "pypi":
      return PYPI_PACKAGE_PATTERN.test(value) && !/\.[A-Z]/.test(value) ? `pkg:pypi/${value}` : null;
    case "maven": {
      const match = MAVEN_COORDINATE_PATTERN.exec(value);
      if (!match) return null;
      const [, group, artifact, version] = match;
      return `pkg:maven/${group}/${artifact}${version ? `@${version}` : ""}`;
    }
    case "nuget":
      return NUGET_PACKAGE_PATTERN.test(value) ? `pkg:nuget/${value}` : null;
    case "golang":
      return GOLANG_MODULE_PATTERN.test(value) ? `pkg:golang/${value}` : null;
    case "composer":
      return COMPOSER_PACKAGE_PATTERN.test(value) ? `pkg:composer/${value}` : null;
    case "cargo":
      return CARGO_CRATE_PATTERN.test(value) ? `pkg:cargo/${value}` : null;
    case "hex":
    case "pub":
      return UNDERSCORE_LOWERCASE_PACKAGE_PATTERN.test(value) ? `pkg:${componentType}/${value}` : null;
    case "gem":
      return GEM_NAME_PATTERN.test(value) ? `pkg:gem/${value}` : null;
    default:
      return null;
  }
}

function validateAndNormalizePurl(rawPurl: string): string {
  const normalized = normalizePurl(rawPurl);
  parsePurl(normalized);
  return normalized;
}

function resolveComponentType(purlOrName: string, ruleId: string): string | undefined {
  if (purlOrName.trim().toLowerCase().startsWith("pkg:")) {
    return parsePurl(normalizePurl(purlOrName)).type;
  }
  const matchedRule = resolveCandidateRules(purlOrName).find((candidate) => candidate.id === ruleId);
  return matchedRule ? parsePurl(matchedRule.purl).type : undefined;
}

export function formatReplacement(purlOrName: string, ruleId: string, rawReplacement: string): string | null {
  const trimmed = rawReplacement.trim();
  if (trimmed === "") return null;
  if (trimmed.toLowerCase().startsWith("pkg:")) {
    return validateAndNormalizePurl(trimmed);
  }
  const componentType = resolveComponentType(purlOrName, ruleId);
  const candidatePurl = buildPackagePurl(componentType, trimmed);
  if (candidatePurl !== null) {
    return validateAndNormalizePurl(candidatePurl);
  }
  return trimmed;
}

/**
 * Returns the replacement named by the highest-precedence matching lifecycle rule for
 * `purl` at `version`, or `null` when no matching rule provides a replacement.
 * Never returns an empty string and never throws for missing replacements.
 * When a rule names a replacement package or PURL, returns its canonical normalised PURL
 * validated via `src/purl.ts`. Non-package replacement guidance strings are preserved as-is.
 * Delegates rule resolution, ordering, and version matching to {@link check}.
 */
export function replacementFor(purl: string, version: string): string | null {
  const { matches } = check(purl, version);
  const match = matches.find((entry) => entry.replacement !== null && entry.replacement.trim() !== "");
  if (!match || match.replacement === null) return null;
  const formatted = formatReplacement(purl, match.ruleId, match.replacement);
  return formatted === null || formatted.trim() === "" ? null : formatted;
}
