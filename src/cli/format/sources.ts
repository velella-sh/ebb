import type { SourcesOfResult } from "../../sources-of.js";
import { createColors } from "./color.js";

export interface FormatSourcesOptions {
  colors?: ReturnType<typeof createColors>;
}

export function formatSourcesText(result: SourcesOfResult, options: FormatSourcesOptions = {}): string {
  const c = options.colors ?? createColors(false);
  const lines: string[] = [];

  lines.push(`${c.bold("Rule:")} ${result.ruleId}`);
  lines.push(`${c.bold("Ecosystem:")} ${result.ecosystem}`);
  lines.push(`${c.bold("PURL:")} ${result.purl}`);
  lines.push(`${c.bold("Event:")} ${result.event}`);
  lines.push(`${c.bold("Title:")} ${result.title}`);
  if (result.deadline) {
    lines.push(`${c.bold("Deadline:")} ${result.deadline}`);
  }
  if (result.replacement) {
    lines.push(`${c.bold("Replacement:")} ${result.replacement}`);
  }
  if (result.method) {
    lines.push(`${c.bold("Method:")} ${result.method}`);
  }
  const reviewersText = result.reviewers && result.reviewers.length > 0 ? result.reviewers.join(", ") : result.reviewer;
  lines.push(
    `${c.bold("Reviewer:")} ${reviewersText} (reviewed: ${result.reviewedAt}, observed: ${result.observedAt})`,
  );
  if (result.importer) {
    const impVer = result.importerVersion ? ` (${result.importerVersion})` : "";
    lines.push(`${c.bold("Importer:")} ${result.importer}${impVer}`);
  }
  lines.push("");

  const count = result.sources.length;
  lines.push(`${c.bold(`Sources (${count}):`)}`);

  if (count === 0) {
    lines.push("  No sources recorded.");
  } else {
    for (let i = 0; i < count; i++) {
      const s = result.sources[i]!;
      const healthBadge = s.health === "ok" ? c.green(`[${s.health}]`) : c.yellow(`[${s.health}]`);
      lines.push(`${i + 1}. ${c.bold(s.title)} ${healthBadge}`);
      lines.push(`   URL: ${s.url}`);
      if (s.archiveUrl) {
        const at = s.archivedAt ? ` (archived: ${s.archivedAt})` : "";
        lines.push(`   Archive: ${s.archiveUrl}${at}`);
      }
      if (s.accessedAt) {
        lines.push(`   Accessed: ${s.accessedAt}`);
      }
      if (i < count - 1) {
        lines.push("");
      }
    }
  }

  return lines.join("\n") + "\n";
}

export function formatSourcesMarkdown(result: SourcesOfResult): string {
  const lines: string[] = [];

  lines.push(`# Sources for \`${result.ruleId}\``);
  lines.push("");
  lines.push(`- **Ecosystem:** ${result.ecosystem}`);
  lines.push(`- **PURL:** \`${result.purl}\``);
  lines.push(`- **Event:** \`${result.event}\``);
  lines.push(`- **Title:** ${result.title}`);
  if (result.deadline) {
    lines.push(`- **Deadline:** \`${result.deadline}\``);
  }
  if (result.replacement) {
    lines.push(`- **Replacement:** \`${result.replacement}\``);
  }
  if (result.method) {
    lines.push(`- **Method:** \`${result.method}\``);
  }
  const reviewersMd = result.reviewers && result.reviewers.length > 0 ? result.reviewers.join(", ") : result.reviewer;
  lines.push(`- **Reviewer:** ${reviewersMd} (reviewed: \`${result.reviewedAt}\`, observed: \`${result.observedAt}\`)`);
  if (result.importer) {
    const impVer = result.importerVersion ? ` (\`${result.importerVersion}\`)` : "";
    lines.push(`- **Importer:** \`${result.importer}\`${impVer}`);
  }
  lines.push("");

  const count = result.sources.length;
  lines.push(`## Evidence Sources (${count})`);
  lines.push("");

  if (count === 0) {
    lines.push("No sources recorded.");
  } else {
    for (let i = 0; i < count; i++) {
      const s = result.sources[i]!;
      lines.push(`${i + 1}. **${s.title}** \`[${s.health}]\``);
      lines.push(`   - URL: <${s.url}>`);
      if (s.archiveUrl) {
        const at = s.archivedAt ? ` (archived: \`${s.archivedAt}\`)` : "";
        lines.push(`   - Archive: <${s.archiveUrl}>${at}`);
      }
      if (s.accessedAt) {
        lines.push(`   - Accessed: \`${s.accessedAt}\``);
      }
    }
  }

  return lines.join("\n") + "\n";
}
