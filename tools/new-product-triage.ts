import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { purlIdentity } from "../src/purl.js";
import { type ReadEvidence, evidenceUrl, readEvidence, safeRead } from "./new-rule-source.js";

const MONTH = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATES = new RegExp(
  `\\b(?:20\\d{2}-\\d{2}-\\d{2}|(?:${MONTH})\\s+\\d{1,2},?\\s+20\\d{2}|\\d{1,2}\\s+(?:${MONTH})\\s+20\\d{2})\\b`,
  "gi",
);
const LIFECYCLE = /end[ -]of[ -](?:life|(?:active[ -]|extended[ -])?support)|deprecat|retire|no longer supported/i;
const MARKER = "<!-- ebb-new-product-triage -->";

export function issueField(body: string, heading: string): string {
  const section = `\n${body.replaceAll("\r\n", "\n")}`
    .split("\n### ")
    .find((part) => part.trimStart().startsWith(`${heading}\n`));
  return section?.trim().split("\n").slice(1).join("\n").trim() ?? "";
}

function canonicalPurl(input: string): string | undefined {
  try {
    return purlIdentity(input);
  } catch {
    return undefined;
  }
}

function textOf(fragment: string): string {
  return fragment
    .replace(/<[^>]*>|&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tableDate(html: string): string | undefined {
  for (const table of html.matchAll(/<table\b[^>]*>([^]*?)<\/table>/gi)) {
    let deadlineColumn = -1;
    for (const row of (table[1] ?? "").matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)) {
      const cells = [...(row[1] ?? "").matchAll(/<(t[dh])\b[^>]*>([^]*?)<\/\1>/gi)];
      if (deadlineColumn < 0) {
        deadlineColumn = cells.findIndex(
          (cell) => cell[1]?.toLowerCase() === "th" && LIFECYCLE.test(textOf(cell[2] ?? "")),
        );
        continue;
      }
      const candidate = textOf(cells[deadlineColumn]?.[2] ?? "");
      const date = [...candidate.matchAll(DATES)][0]?.[0];
      if (date === candidate) return date;
    }
  }
  return undefined;
}

function lifecycleDate(text: string): string | undefined {
  const html = text.replace(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1>/gi, " ");
  const inTable = tableDate(html);
  if (inTable) return inTable;
  const content = textOf(html.replace(/<table\b[^>]*>[^]*?<\/table>/gi, " "));
  for (const match of content.matchAll(DATES)) {
    const index = match.index ?? 0;
    const preceding = content.slice(Math.max(0, index - 90), index);
    if (
      /(?:end[ -]of[ -](?:life|(?:active[ -]|extended[ -])?support)|deprecat(?:ed|ion)|retir(?:e|ed|ement)|no longer supported)(?:\s+(?:on|as of|after|since|date|is|was|will be))*\s*[:–—-]?\s*$/i.test(
        preceding,
      )
    )
      return match[0];
  }
  return undefined;
}

export async function triageProduct(body: string, read: ReadEvidence = readEvidence) {
  const purl = canonicalPurl(issueField(body, "Package URL (purl)"));
  let source: URL | undefined;
  try {
    source = evidenceUrl(issueField(body, "Authoritative Evidence URL"));
  } catch {
    // The form accepts anything; incomplete submissions get a specific follow-up.
  }
  const text = source ? await safeRead(source.href, read) : undefined;
  const date = text === undefined ? undefined : lifecycleDate(text);
  const status = !source
    ? "Add an authoritative public HTTPS vendor URL."
    : text === undefined
      ? "The supplied source could not be read. Check the link or provide a stable vendor URL."
      : date
        ? `Found a possible lifecycle date: ${date}.`
        : LIFECYCLE.test(text)
          ? "Found lifecycle policy wording, but no explicit date. Confirm what versions and event it covers."
          : "No lifecycle date or policy was found. Add a vendor source that states the affected versions and event.";
  const lines = [
    MARKER,
    "### New product evidence",
    "",
    status,
    "",
    purl ? `Suggested Package URL: \`${purl.replaceAll("`", "")}\`.` : "Add a canonical package URL if one exists.",
    source ? `Use this authoritative URL as the source input: <${source.href.replaceAll(">", "%3E")}>.` : "",
    date ? `Confirm the date (${date}) applies to the target release before entering it.` : "",
    "",
    "Use `npm run new-rule` in a clone and enter the VERS range, event and date from the vendor evidence. A maintainer still reviews the claim.",
  ];
  return { comment: lines.join("\n"), dated: date !== undefined };
}

async function main(): Promise<void> {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH ?? "", "utf8"));
  const result = await triageProduct(event.issue?.body ?? "");
  await writeFile(resolve("new-product-triage.md"), result.comment);
  await appendFile(process.env.GITHUB_OUTPUT ?? "", `dated=${result.dated}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
