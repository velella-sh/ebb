/**
 * Package URL (PURL) parsing and canonical formatting.
 * https://github.com/package-url/purl-spec
 */

import { EbbError } from "./errors.js";

export interface PackageUrl {
  type: string;
  namespace?: string;
  name: string;
  version?: string;
  qualifiers?: Record<string, string>;
  subpath?: string;
}

export class PurlError extends EbbError {
  constructor(message: string) {
    super("invalid-purl", message);
    this.name = "PurlError";
  }
}

const TYPE_PATTERN = /^[a-z][a-z0-9.+-]*$/;

/**
 * A qualifier key is a lowercase ASCII letter, then letters, digits, `.`, `-`, or `_`.
 * Keys are not percent-encoded. ECMA-427 clause 5.6.6.
 */
const QUALIFIER_KEY = /^[a-z][a-z0-9._-]*$/;

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new PurlError(`Invalid percent-encoding in "${segment}".`);
  }
}

/**
 * Percent-encode one component segment per ECMA-427 clause 5.4.
 * Alphanumeric, punctuation `.-_~`, and `:` stay literal; every other
 * UTF-8 byte becomes `%HH`. Separator characters inside a segment
 * (`/@?#=&`) are encoded so they cannot be read as PURL delimiters.
 */
const ENCODE_SAFE = /[A-Za-z0-9._~:-]/;
const utf8 = new TextEncoder();

function encode(segment: string): string {
  let result = "";
  for (const char of segment) {
    if (ENCODE_SAFE.test(char)) {
      result += char;
      continue;
    }
    for (const byte of utf8.encode(char)) {
      result += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return result;
}

/**
 * Drops trailing `/` characters from a PURL path. A PURL comes from repository files and lockfiles,
 * so it is untrusted: the loop stays linear where `/\/+$/` backtracks quadratically on a long run of
 * slashes (`js/polynomial-redos`).
 */
function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 0x2f) end -= 1;
  return end === value.length ? value : value.slice(0, end);
}

/**
 * Per-type normalisation and shape rules from the registered PURL type definitions.
 * One entry per type: case folding, name/namespace transforms, and required/prohibited parts.
 */
type TypeRule = {
  /** Lowercase each namespace segment. */
  lowercaseNamespace?: boolean;
  /** Lowercase the name (or each `/`-separated name segment). */
  lowercaseName?: boolean;
  /** Lowercase the version. */
  lowercaseVersion?: boolean;
  /** Uppercase the namespace (CPAN author id). */
  uppercaseNamespace?: boolean;
  /** Namespace must be present, or must be absent. */
  namespace?: "required" | "prohibited";
  /** Extra name transform after optional lowercasing (PyPI underscores, MLflow host rules). */
  transformName?: (name: string, qualifiers: Record<string, string> | undefined) => string;
  /** Reject a name that does not match (after transforms). */
  namePattern?: RegExp;
  /** When a version is present, it must match. */
  versionPattern?: RegExp;
  /** Qualifier keys that must be present after canonicalisation. */
  requireQualifiers?: readonly string[];
  /**
   * How to split the path into namespace and name.
   * `git`: first segment is the host namespace; the rest is the repository path (name may contain `/`).
   * default: last segment is the name; earlier segments are the namespace.
   */
  pathStyle?: "git";
};

const TYPE_RULES: Record<string, TypeRule> = {
  bitbucket: { lowercaseNamespace: true, lowercaseName: true, namespace: "required" },
  brew: { lowercaseNamespace: true, lowercaseName: true },
  "chrome-extension": {
    namespace: "prohibited",
    lowercaseName: true,
    namePattern: /^[a-p]{32}$/,
    versionPattern: /^\d+(\.\d+){0,3}$/,
  },
  composer: { lowercaseNamespace: true, lowercaseName: true },
  cpan: { uppercaseNamespace: true, namePattern: /^(?!.*::).+/ },
  docker: { lowercaseNamespace: true, lowercaseName: true },
  git: { lowercaseNamespace: true, lowercaseName: true, namespace: "required", pathStyle: "git" },
  github: { lowercaseNamespace: true, lowercaseName: true, namespace: "required" },
  golang: { lowercaseNamespace: true, lowercaseName: true },
  huggingface: { lowercaseVersion: true, namespace: "required" },
  julia: { namespace: "prohibited", requireQualifiers: ["uuid"] },
  mlflow: {
    namespace: "prohibited",
    transformName: (name, qualifiers) => {
      const repositoryUrl = qualifiers?.repository_url?.toLowerCase() ?? "";
      // Databricks model names are case-insensitive; Azure ML keeps the given case.
      if (repositoryUrl.includes("databricks")) return name.toLowerCase();
      return name;
    },
  },
  npm: { lowercaseNamespace: true, lowercaseName: true },
  otp: { lowercaseName: true, namespace: "prohibited" },
  pub: { lowercaseName: true },
  pypi: {
    namespace: "prohibited",
    transformName: (name) => name.toLowerCase().replace(/_/g, "-"),
  },
  rpm: { lowercaseNamespace: true, namespace: "required" },
  swift: { namespace: "required" },
  vcpkg: { namespace: "prohibited" },
  "vscode-extension": { namespace: "required" },
};

function typeRule(type: string): TypeRule | undefined {
  return TYPE_RULES[type];
}

function normalize(purl: PackageUrl): PackageUrl {
  const type = purl.type.toLowerCase();
  const rule = typeRule(type);
  const qualifiers = canonicalQualifiers(purl.qualifiers);

  let namespace = purl.namespace;
  let name = purl.name;
  let version = purl.version;

  if (rule?.lowercaseNamespace && namespace) namespace = namespace.toLowerCase();
  if (rule?.uppercaseNamespace && namespace) namespace = namespace.toUpperCase();
  if (rule?.lowercaseName) name = name.toLowerCase();
  if (rule?.transformName) name = rule.transformName(name, qualifiers);
  if (rule?.lowercaseVersion && version !== undefined) version = version.toLowerCase();

  if (rule?.namespace === "required" && !namespace) {
    throw new PurlError(`PURL type "${type}" requires a namespace.`);
  }
  if (rule?.namespace === "prohibited" && namespace) {
    throw new PurlError(`PURL type "${type}" must not have a namespace.`);
  }
  if (rule?.namePattern && !rule.namePattern.test(name)) {
    throw new PurlError(`Invalid PURL name "${name}" for type "${type}".`);
  }
  if (rule?.versionPattern && version !== undefined && !rule.versionPattern.test(version)) {
    throw new PurlError(`Invalid PURL version "${version}" for type "${type}".`);
  }
  if (rule?.requireQualifiers) {
    for (const key of rule.requireQualifiers) {
      if (!qualifiers?.[key]) throw new PurlError(`PURL type "${type}" requires qualifier "${key}".`);
    }
  }

  const subpath = normalizeSubpath(purl.subpath);
  return {
    type,
    ...(namespace ? { namespace } : {}),
    name,
    ...(version !== undefined ? { version } : {}),
    ...(qualifiers ? { qualifiers } : {}),
    ...(subpath ? { subpath } : {}),
  };
}

/**
 * Qualifier rules from the spec: lowercase keys, drop empty values, reject a repeated key,
 * and keep the map sorted by key so the canonical string and the parsed object agree.
 */
function canonicalQualifiers(qualifiers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!qualifiers) return undefined;
  const entries: [string, string][] = [];
  const seen = new Set<string>();
  for (const [rawKey, rawValue] of Object.entries(qualifiers)) {
    if (!rawValue) continue;
    const key = rawKey.toLowerCase();
    if (!QUALIFIER_KEY.test(key)) throw new PurlError(`Invalid qualifier key "${rawKey}".`);
    if (seen.has(key)) throw new PurlError(`Duplicate qualifier key "${key}".`);
    seen.add(key);
    entries.push([key, rawValue]);
  }
  if (entries.length === 0) return undefined;
  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

/**
 * Subpath rules from the spec: split on `/`, drop empty, `.`, and `..` segments.
 * A segment must not contain `/`. ECMA-427 clause 5.6.7.
 */
function normalizeSubpath(subpath: string | undefined): string | undefined {
  if (subpath === undefined || subpath === "") return undefined;
  const segments = subpath.split("/").filter((segment) => segment && segment !== "." && segment !== "..");
  return segments.length > 0 ? segments.join("/") : undefined;
}

/**
 * Parse the `#subpath` fragment: percent-decode each segment, then apply the
 * same empty / `.` / `..` rules as normalize. How-to-parse procedure.
 */
function parseSubpath(raw: string): string | undefined {
  const segments: string[] = [];
  for (const part of raw.split("/")) {
    if (!part) continue;
    const segment = decode(part);
    if (!segment || segment === "." || segment === "..") continue;
    if (segment.includes("/")) throw new PurlError(`Invalid subpath segment "${part}".`);
    segments.push(segment);
  }
  return segments.length > 0 ? segments.join("/") : undefined;
}

/** Splits the `#subpath` fragment off a PURL once from the right. */
function takeSubpath(rest: string): { rest: string; subpath?: string } {
  const hash = rest.lastIndexOf("#");
  if (hash < 0) return { rest };
  const subpath = parseSubpath(rest.slice(hash + 1));
  return { rest: rest.slice(0, hash), ...(subpath ? { subpath } : {}) };
}

type QualifierKeyOptions = { lowercaseQualifierKeys: boolean };

/**
 * Parse the `?qualifiers` query into a map.
 * ECMA-427 §5.6.6: a key shall be lowercase ASCII. Required parse rejects a
 * non-lowercase key; lenient parse (recommended remediation) lowercases it.
 */
function parseQualifiers(query: string, value: string, options: QualifierKeyOptions): Record<string, string> {
  const qualifiers: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const equals = pair.indexOf("=");
    if (equals < 0) throw new PurlError(`Invalid qualifier "${pair}": missing "=" in ${value}`);
    if (equals === 0) throw new PurlError(`Invalid qualifier "${pair}": missing key in ${value}`);
    const qualifierValue = decode(pair.slice(equals + 1));
    // An empty value is the same as omitting the pair. Skip it before the duplicate check
    // so `foo=1&foo=` stays a single `foo`.
    if (!qualifierValue) continue;
    const rawKey = pair.slice(0, equals);
    if (!options.lowercaseQualifierKeys && rawKey !== rawKey.toLowerCase()) {
      throw new PurlError(`Qualifier key "${rawKey}" must be lowercase in ${value}`);
    }
    const key = rawKey.toLowerCase();
    if (!QUALIFIER_KEY.test(key)) throw new PurlError(`Invalid qualifier key "${rawKey}".`);
    if (Object.hasOwn(qualifiers, key)) throw new PurlError(`Duplicate qualifier key "${key}" in ${value}`);
    qualifiers[key] = qualifierValue;
  }
  return qualifiers;
}

/**
 * When `?` appears before any `/`, the string before `?` is the type with no name.
 * Check it here so `pkg:n&g?…` names an invalid type instead of a bogus qualifier.
 */
function requireTypeBeforeQuery(beforeQuery: string, value: string): void {
  if (!beforeQuery) throw new PurlError(`PURL is missing a type: ${value}`);
  if (beforeQuery.includes("/")) return;
  const type = beforeQuery.toLowerCase();
  if (!TYPE_PATTERN.test(type)) throw new PurlError(`Invalid PURL type "${type}".`);
  throw new PurlError(`PURL is missing a name: ${value}`);
}

/** Splits the `?qualifiers` query off a PURL. */
function takeQualifiers(
  rest: string,
  value: string,
  options: QualifierKeyOptions,
): { rest: string; qualifiers?: Record<string, string> } {
  const question = rest.indexOf("?");
  if (question < 0) return { rest };
  requireTypeBeforeQuery(rest.slice(0, question), value);
  return {
    rest: rest.slice(0, question),
    qualifiers: parseQualifiers(rest.slice(question + 1), value, options),
  };
}

/**
 * Reads the lowercased type before the first `/`, then the path after it.
 * Leading slashes after `pkg:` are ignored for `pkg:/type/name`, but a lone
 * `pkg:/name` has an empty type and must say so (not "missing a name").
 */
function splitTypeAndPath(rest: string, value: string): { type: string; rest: string } {
  const hadLeadingSlash = rest.startsWith("/");
  rest = rest.replace(/^\/+/, "");
  const slash = rest.indexOf("/");
  if (slash < 0) {
    if (!rest || hadLeadingSlash) throw new PurlError(`PURL is missing a type: ${value}`);
    throw new PurlError(`PURL is missing a name: ${value}`);
  }
  const type = rest.slice(0, slash).toLowerCase();
  if (!TYPE_PATTERN.test(type)) throw new PurlError(`Invalid PURL type "${type}".`);
  return { type, rest: trimTrailingSlashes(rest.slice(slash + 1)) };
}

/**
 * Splits the `@version` suffix off a PURL path once from the right.
 * When `@` is the first character and the rest still contains `/` (for example
 * an npm scope `@babel/core`), that `@` belongs to the path, not the version.
 * A lone `@1.2.3` with no `/` stays a version with a missing name.
 */
function takeVersion(rest: string): { rest: string; version?: string } {
  const at = rest.lastIndexOf("@");
  if (at < 0) return { rest };
  if (at === 0 && rest.includes("/", 1)) return { rest };
  return { rest: rest.slice(0, at), version: decode(rest.slice(at + 1)) };
}

/**
 * Splits the path into namespace and name. Most types use the last segment as the name;
 * `git` keeps the repository path (with `/`) in the name and only the host in the namespace.
 * A trailing `/` means the name is missing (`pkg:swift/github.com/Alamofire/@1.0`).
 */
function splitName(rest: string, value: string, type: string): { name: string; namespace: string | undefined } {
  if (!rest || rest.endsWith("/")) throw new PurlError(`PURL is missing a name: ${value}`);
  const segments = rest.split("/").filter(Boolean).map(decode);
  if (segments.length === 0) throw new PurlError(`PURL is missing a name: ${value}`);

  if (typeRule(type)?.pathStyle === "git") {
    const namespace = segments[0];
    const name = segments.slice(1).join("/");
    if (!namespace || !name) throw new PurlError(`PURL is missing a name: ${value}`);
    return { name, namespace };
  }

  const name = segments.pop();
  if (!name) throw new PurlError(`PURL is missing a name: ${value}`);
  return {
    name,
    namespace: segments.length > 0 ? segments.join("/") : undefined,
  };
}

/**
 * Parse a PURL string into components.
 * Qualifier keys must already be lowercase (ECMA-427 §5.6.6). Use
 * {@link normalizePurl} when the input may need recommended remediation.
 */
export function parsePurl(value: string): PackageUrl {
  return parsePurlInternal(value, { lowercaseQualifierKeys: false });
}

function parsePurlInternal(value: string, options: QualifierKeyOptions): PackageUrl {
  if (!value.trim().startsWith("pkg:")) throw new PurlError(`PURL must start with "pkg:": ${value}`);
  // Keep leading slashes so splitTypeAndPath can tell `pkg:/x` (empty type) from `pkg:x` (no name).
  const body = value.trim().slice(4);
  const { rest: withoutSubpath, subpath } = takeSubpath(body);
  const { rest: withoutQuery, qualifiers } = takeQualifiers(withoutSubpath, value, options);
  const { type, rest: path } = splitTypeAndPath(withoutQuery, value);
  const { rest: withoutVersion, version } = takeVersion(path);
  const { name, namespace } = splitName(withoutVersion, value, type);

  return normalize({
    type,
    ...(namespace ? { namespace } : {}),
    name,
    ...(version ? { version } : {}),
    ...(qualifiers ? { qualifiers } : {}),
    ...(subpath ? { subpath } : {}),
  });
}

export function formatPurl(purl: PackageUrl): string {
  const canonical = normalize(purl);
  if (!TYPE_PATTERN.test(canonical.type)) throw new PurlError(`Invalid PURL type "${canonical.type}".`);
  if (!canonical.name) throw new PurlError("PURL name is required.");

  let result = `pkg:${canonical.type}/`;
  if (canonical.namespace) {
    result += `${canonical.namespace.split("/").filter(Boolean).map(encode).join("/")}/`;
  }
  // `git` names are a repository path: encode each segment, keep `/` as a separator.
  // Every other type treats the name as one segment, so `/` is percent-encoded.
  result +=
    typeRule(canonical.type)?.pathStyle === "git"
      ? canonical.name.split("/").filter(Boolean).map(encode).join("/")
      : encode(canonical.name);
  if (canonical.version) result += `@${encode(canonical.version)}`;
  if (canonical.qualifiers) {
    const pairs = Object.entries(canonical.qualifiers).map(
      ([key, qualifierValue]) => `${key}=${encode(qualifierValue)}`,
    );
    result += `?${pairs.join("&")}`;
  }
  if (canonical.subpath) {
    result += `#${canonical.subpath.split("/").filter(Boolean).map(encode).join("/")}`;
  }
  return result;
}

/**
 * Returns the canonical form of a PURL string.
 * Applies recommended remediations such as lowercasing qualifier keys.
 */
export function normalizePurl(value: string): string {
  return formatPurl(parsePurlInternal(value, { lowercaseQualifierKeys: true }));
}

/** Returns the PURL without version, qualifiers, or subpath: the identity registry rules use. */
export function purlIdentity(value: string | PackageUrl): string {
  const parsed = typeof value === "string" ? parsePurl(value) : value;
  return formatPurl({
    type: parsed.type,
    ...(parsed.namespace ? { namespace: parsed.namespace } : {}),
    name: parsed.name,
  });
}
