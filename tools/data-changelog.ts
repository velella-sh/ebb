// Generates and updates DATA-CHANGELOG.md and data-changelog.atom from data diffs.
//
//   node dist/tools/data-changelog.js --from 0.3.0 --to active --version 0.4.0 --date 2026-11-14 --pr 360
//
// Groups changes by ecosystem, credits contributors, links pull requests,
// updates the Atom feed, and prepends new entries to DATA-CHANGELOG.md.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { diff, type DataDiffResult } from "../src/diff.js";
import type { RegistryV2Rule } from "../src/registry.js";

export interface ChangelogFormatOptions {
  version: string;
  date?: string | undefined;
  pullRequest?: string | number | undefined;
  contributor?: string | undefined;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  summary: string;
  content: string;
  author?: string | undefined;
}

export interface AtomFeedOptions {
  title?: string | undefined;
  subtitle?: string | undefined;
  feedUrl?: string | undefined;
  siteUrl?: string | undefined;
  updated?: string | undefined;
  author?: string | undefined;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ruleContributor(rule: RegistryV2Rule, fallback?: string): string {
  return rule.provenance?.reviewer || fallback || "arminazimi";
}

function prMarkdown(pr?: string | number): string {
  if (!pr) return "";
  const num = String(pr).replace(/^#/, "");
  return ` in [#${num}](https://github.com/velella-sh/ebb/pull/${num})`;
}

/**
 * Formats a clean Markdown changelog section for a release from a DataDiffResult.
 */
export function formatChangelogSection(diffResult: DataDiffResult, options: ChangelogFormatOptions): string {
  const version = options.version;
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`## [${version}] - ${date}\n`);

  // Summary section
  lines.push("### Summary");
  lines.push(`- **Added:** ${diffResult.summary.added} rule${diffResult.summary.added === 1 ? "" : "s"}`);
  lines.push(`- **Changed:** ${diffResult.summary.changed} rule${diffResult.summary.changed === 1 ? "" : "s"}`);
  lines.push(`- **Removed:** ${diffResult.summary.removed} rule${diffResult.summary.removed === 1 ? "" : "s"}`);
  if (diffResult.summary.renamed > 0) {
    lines.push(`- **Renamed:** ${diffResult.summary.renamed} rule${diffResult.summary.renamed === 1 ? "" : "s"}`);
  }
  lines.push(`- **Total Active:** ${diffResult.summary.totalTo} rules\n`);

  // Collect all ecosystems with changes
  const allEcosystems = Object.keys(diffResult.summary.byEcosystem).sort();

  for (const eco of allEcosystems) {
    const ecoDiff = diffResult.summary.byEcosystem[eco];
    if (!ecoDiff) continue;
    if (ecoDiff.added === 0 && ecoDiff.changed === 0 && ecoDiff.removed === 0 && ecoDiff.renamed === 0) {
      continue;
    }

    lines.push(`### ${eco}`);

    // Added rules in this ecosystem
    const added = diffResult.added.filter((r) => r.ecosystem === eco);
    for (const rule of added) {
      const credit = ruleContributor(rule, options.contributor);
      const prStr = prMarkdown(options.pullRequest);
      const deadlineStr = rule.deadline ? `, deadline: ${rule.deadline}` : "";
      lines.push(
        `- **Added** \`${rule.id}\` (\`${rule.purl}\`): ${rule.title} (${rule.event}, vers: \`${rule.vers}\`${deadlineStr}) by @${credit}${prStr}`,
      );
    }

    // Changed rules in this ecosystem
    const changed = diffResult.changed.filter((c) => c.ecosystem === eco);
    for (const ch of changed) {
      const credit = ruleContributor(ch.toRule, options.contributor);
      const prStr = prMarkdown(options.pullRequest);
      const changeSummaries = ch.changes.map((c) => c.description ?? `${c.field} updated`).join("; ");
      lines.push(`- **Changed** \`${ch.id}\` (\`${ch.purl}\`): ${ch.title} — ${changeSummaries} by @${credit}${prStr}`);
    }

    // Renamed rules in this ecosystem
    const renamed = diffResult.renamed.filter((r) => r.ecosystem === eco);
    for (const ren of renamed) {
      const credit = ruleContributor(ren.toRule, options.contributor);
      const prStr = prMarkdown(options.pullRequest);
      lines.push(`- **Renamed** \`${ren.fromId}\` → \`${ren.toId}\` (\`${ren.purl}\`) by @${credit}${prStr}`);
    }

    // Removed rules in this ecosystem
    const removed = diffResult.removed.filter((r) => r.ecosystem === eco);
    for (const rule of removed) {
      const credit = ruleContributor(rule, options.contributor);
      const prStr = prMarkdown(options.pullRequest);
      lines.push(`- **Removed** \`${rule.id}\` (\`${rule.purl}\`): ${rule.title} by @${credit}${prStr}`);
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Generates an Atom XML feed from a list of changelog release items.
 */
export function generateAtomFeed(releases: ChangelogRelease[], options: AtomFeedOptions = {}): string {
  const title = options.title ?? "Ebb Lifecycle Data Changelog";
  const subtitle =
    options.subtitle ?? "Track additions, updates, deprecations and removals in the Ebb lifecycle dataset.";
  const feedUrl = options.feedUrl ?? "https://velella.sh/ebb/data-changelog.atom";
  const siteUrl = options.siteUrl ?? "https://velella.sh/ebb/data-changelog/";
  const updated = options.updated ?? (releases[0]?.date ? `${releases[0].date}T00:00:00Z` : new Date().toISOString());
  const author = options.author ?? "Ebb Maintainers";

  const entriesXml = releases
    .map((rel) => {
      const entryId = `tag:velella.sh,${rel.date}:ebb:data-release:${rel.version}`;
      const entryUrl = `https://github.com/velella-sh/ebb/releases/tag/v${rel.version}`;
      const entryUpdated = `${rel.date}T00:00:00Z`;
      const entryAuthor = rel.author ?? author;

      return `  <entry>
    <title>Ebb Lifecycle Data ${escapeXml(rel.version)} (${escapeXml(rel.date)})</title>
    <link href="${escapeXml(entryUrl)}" rel="alternate" type="text/html"/>
    <id>${escapeXml(entryId)}</id>
    <updated>${escapeXml(entryUpdated)}</updated>
    <summary type="text">${escapeXml(rel.summary)}</summary>
    <content type="html"><![CDATA[${rel.content}]]></content>
    <author>
      <name>${escapeXml(entryAuthor)}</name>
    </author>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <subtitle>${escapeXml(subtitle)}</subtitle>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml"/>
  <link href="${escapeXml(siteUrl)}" rel="alternate" type="text/html"/>
  <id>${escapeXml(siteUrl)}</id>
  <updated>${escapeXml(updated)}</updated>
  <author>
    <name>${escapeXml(author)}</name>
    <uri>https://github.com/velella-sh/ebb</uri>
  </author>
${entriesXml}
</feed>
`;
}

/**
 * Prepend or update a release entry into the existing DATA-CHANGELOG.md content.
 */
export function prependChangelogEntry(existingMarkdown: string, newEntryMarkdown: string): string {
  const headerMatch = existingMarkdown.match(/^(#\s+[^\n]+\n+)([\s\S]*)$/);
  if (!headerMatch) {
    return `# Ebb Lifecycle Data Changelog\n\n${newEntryMarkdown}\n\n${existingMarkdown.trim()}\n`;
  }
  const header = headerMatch[1] ?? "";
  const rest = headerMatch[2] ?? "";
  return `${header}${newEntryMarkdown}\n\n${rest.trim()}\n`;
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function main(argv: string[]): Promise<void> {
  const fromTarget = option(argv, "--from") ?? "bundled";
  const toTarget = option(argv, "--to") ?? "active";
  const version = option(argv, "--version") ?? "0.4.0";
  const date = option(argv, "--date") ?? new Date().toISOString().slice(0, 10);
  const pr = option(argv, "--pr");
  const contributor = option(argv, "--contributor");
  const outMd = resolve(option(argv, "--out-md") ?? "DATA-CHANGELOG.md");
  const outFeed = resolve(option(argv, "--out-feed") ?? "docs/data-changelog.atom");

  const diffResult = await diff(fromTarget, toTarget);
  const section = formatChangelogSection(diffResult, {
    version,
    date,
    pullRequest: pr,
    contributor,
  });

  // Read existing changelog if present
  let existing = "";
  try {
    existing = await readFile(outMd, "utf8");
  } catch {
    // If not found, create new
  }

  const updatedMd = prependChangelogEntry(existing, section);
  await mkdir(dirname(outMd), { recursive: true });
  await writeFile(outMd, updatedMd, "utf8");
  process.stdout.write(`Updated ${outMd} with data release [${version}]\n`);

  // Write Atom feed
  const releaseEntry: ChangelogRelease = {
    version,
    date,
    summary: `Ebb lifecycle data release ${version}: ${diffResult.summary.added} added, ${diffResult.summary.changed} changed, ${diffResult.summary.removed} removed.`,
    content: `<pre>${escapeXml(section)}</pre>`,
    author: contributor ?? "Ebb Maintainers",
  };
  const feedXml = generateAtomFeed([releaseEntry]);
  await mkdir(dirname(outFeed), { recursive: true });
  await writeFile(outFeed, feedXml, "utf8");
  process.stdout.write(`Wrote Atom feed to ${outFeed}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
