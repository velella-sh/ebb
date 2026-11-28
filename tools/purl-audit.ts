import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { parsePurl, purlIdentity } from "../src/purl.js";
import type { RegistryV2Rule } from "../src/registry.js";

const githubDefinition =
  "https://github.com/package-url/purl-spec/blob/26671718c3da7225c582a94da319c0c6c3a60cf7/types/github-definition.json";
const typeIndex =
  "https://github.com/package-url/purl-spec/blob/26671718c3da7225c582a94da319c0c6c3a60cf7/purl-types-index.json";
const serviceProposal = "https://github.com/package-url/purl-spec/discussions/878";
const variantsPath = "registry/tables/image-variants.json";

// These are project-level GitHub release candidates, each tied to its upstream repository.
const repositories: ReadonlyMap<string, string> = new Map([
  ["bun", "oven-sh/bun"],
  ["deno", "denoland/deno"],
  ["elixir", "elixir-lang/elixir"],
  ["erlang", "erlang/otp"],
  ["kubernetes", "kubernetes/kubernetes"],
  ["nodejs", "nodejs/node"],
  ["powershell", "PowerShell/PowerShell"],
  ["ruby", "ruby/ruby"],
  ["rust", "rust-lang/rust"],
  ["sbt", "sbt/sbt"],
  ["terraform", "hashicorp/terraform"],
]);

const managedServices: ReadonlySet<string> = new Set([
  "amazon-eks",
  "aws-aurora",
  "aws-elasticache",
  "aws-lambda-runtime",
  "aws-rds",
  "azure-aks",
  "azure-app-service",
  "azure-database-mysql",
  "azure-database-postgresql",
  "azure-functions",
  "azure-kubernetes-service",
  "google-appengine-runtime",
  "google-cloud-functions-runtime",
  "google-cloud-sql-mysql",
  "google-cloud-sql-postgresql",
  "google-gke",
  "google-kubernetes-engine",
]);

type RuleInput = Pick<RegistryV2Rule, "purl" | "ecosystem" | "sources">;
interface Classification {
  class: "registered-type" | "proposed-type" | "no-confirmed-type";
  candidate: string | null;
  reason: string;
  references: string[];
}

const lexical = (a: string, b: string): number => (a < b ? -1 : Number(a > b));

function classify(purl: string, ecosystems: readonly string[]): Classification {
  const component = purl.slice("pkg:generic/".length);
  const repository = repositories.get(component);
  if (repository) {
    return {
      class: "registered-type",
      candidate: purlIdentity(`pkg:github/${repository}`),
      reason:
        "Repository-level candidate for the upstream project. Release versions and distribution variants need separate equivalence evidence.",
      references: [githubDefinition, `https://github.com/${repository}`],
    };
  }

  if (managedServices.has(component.split("/", 1)[0] ?? "")) {
    return {
      class: "proposed-type",
      candidate: null,
      reason:
        "Managed service or hosted runtime selector. The service proposal may apply, pending a registered type and confirmed provider naming.",
      references: [serviceProposal, typeIndex],
    };
  }

  let reason =
    "The inventory identifies an upstream product scope; a matching package or repository identity has not been established.";
  if (ecosystems.includes("ci-images")) {
    reason =
      "This is a hosted runner image selector. The matching Docker or OCI image artifact and namespace have not been established.";
  } else if (ecosystems.includes("container")) {
    reason =
      "The scope is a base distribution or build-file feature. Published Docker/OCI images and distribution packages have separate identities.";
  } else if (
    component.startsWith("kubernetes/") ||
    component.startsWith("github-actions/") ||
    component.startsWith("cmake-") ||
    component === "android/targetSdk"
  ) {
    reason =
      "This row names a feature, API or configurable platform requirement within a project. The project repository does not identify the individual feature.";
  } else if (component.startsWith("helm-repository/")) {
    reason =
      "This row identifies a repository of charts. No individual chart identity or source mapping is represented by this rule.";
  } else if (component === "golang") {
    reason =
      "The rule covers the Go distribution. A Go module PURL would name a module and would require separate distribution mapping.";
  }
  return { class: "no-confirmed-type", candidate: null, reason, references: [typeIndex] };
}

export function auditGenericPurls(rules: readonly RuleInput[]) {
  const identities = new Map<string, { ecosystems: Map<string, number>; sources: Set<string> }>();
  for (const rule of rules) {
    const parsed = parsePurl(rule.purl);
    if (parsed.type !== "generic") continue;
    const purl = purlIdentity(parsed);
    const row = identities.get(purl) ?? { ecosystems: new Map<string, number>(), sources: new Set<string>() };
    row.ecosystems.set(rule.ecosystem, (row.ecosystems.get(rule.ecosystem) ?? 0) + 1);
    for (const { url } of rule.sources) row.sources.add(url);
    identities.set(purl, row);
  }
  const rows = [...identities]
    .sort(([left], [right]) => lexical(left, right))
    .map(([purl, row]) => {
      const ecosystems = [...row.ecosystems]
        .sort(([a], [b]) => lexical(a, b))
        .map(([ecosystem, rules]) => ({ ecosystem, rules }));
      return {
        purl,
        ecosystems,
        rules: ecosystems.reduce((total, item) => total + item.rules, 0),
        ...classify(
          purl,
          ecosystems.map(({ ecosystem }) => ecosystem),
        ),
        sources: [...row.sources].sort(lexical),
      };
    });
  return {
    distinctGenericPurls: rows.length,
    rulesWithGenericPurl: rows.reduce((total, row) => total + row.rules, 0),
    rows,
  };
}

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trimEnd();
}

function schemaRules(contents: string, path: string): RuleInput[] {
  const document = JSON.parse(contents) as { schemaVersion?: string; rules?: RuleInput[] };
  if (document.schemaVersion !== "ebb.registry.v2") return [];
  if (!Array.isArray(document.rules)) throw new Error(`Missing rule array at ${path}.`);
  return document.rules;
}

function loadAudit(root: string, ref?: string) {
  const commit = ref
    ? git(root, "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`)
    : git(root, "rev-parse", "HEAD");
  const paths = ref
    ? git(root, "ls-tree", "-r", "--name-only", "-z", commit, "--", "registry").split("\0")
    : readdirSync(join(root, "registry")).map((name) => `registry/${name}`);
  const rules = paths
    .filter((path) => /^registry\/[^/]+\.json$/u.test(path))
    .sort()
    .flatMap((path) => {
      const contents = ref ? git(root, "show", `${commit}:${path}`) : readFileSync(join(root, path), "utf8");
      return schemaRules(contents, path);
    });
  if (rules.length === 0) throw new Error("No registry rules were read for the generic PURL audit.");
  const variantsPresent = ref ? paths.includes(variantsPath) : existsSync(join(root, variantsPath));
  return {
    snapshot: { source: ref ? "git-commit" : "working-tree", commit },
    imageVariants: {
      path: variantsPath,
      status: variantsPresent ? "present-unreviewed" : "unavailable",
      skipped: 0,
      followup: "https://github.com/velella-sh/ebb/issues/749",
    },
    ...auditGenericPurls(rules),
  };
}

function markdown(audit: ReturnType<typeof loadAudit>): string {
  const header = [
    "# Generic PURL audit",
    "",
    `${audit.distinctGenericPurls} generic identities across ${audit.rulesWithGenericPurl} rule rows.`,
    `Source ${audit.snapshot.source} at \`${audit.snapshot.commit}\`.`,
    "",
    `Image variants are ${audit.imageVariants.status}. The audit skipped ${audit.imageVariants.skipped} rows for image variants. [Image variant dataset](${audit.imageVariants.followup})`,
    "",
    "| Generic PURL | Ecosystem and rule count | Class | Candidate | Reason |",
    "| --- | --- | --- | --- | --- |",
  ];
  const rows = audit.rows.map(
    (row) =>
      `| \`${row.purl.replaceAll("|", "%7C")}\` | ${row.ecosystems.map(({ ecosystem, rules }) => `${ecosystem} (${rules})`).join(", ")} | ${row.class} | ${row.candidate ? `\`${row.candidate}\`` : "—"} | ${row.reason} ${row.references.map((source, index) => `[source ${index + 1}](${source})`).join(" ")} |`,
  );
  return [...header, ...rows].join("\n");
}

function main(args: string[]) {
  const { values } = parseArgs({ args, options: { ref: { type: "string" }, json: { type: "boolean" } } });
  const audit = loadAudit(process.cwd(), values.ref);
  console.log(values.json ? JSON.stringify(audit, null, 2) : markdown(audit));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
