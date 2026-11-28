/**
 * Plain-text title and summary generation for site data records.
 * Uses fixed templates to build deterministic, search-friendly titles (< 70 chars)
 * and one-sentence summaries (< 160 chars) without HTML or Markdown formatting.
 */

export function sanitizePlainText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // replace markdown links [text](url) with text
    .replace(/[<>*_~`#|]/g, "") // strip angle brackets and markdown formatting characters
    .replace(/[[\]]/g, "") // strip any stray square brackets
    .replace(/\s+/g, " ") // normalize whitespace
    .trim();
}

function truncateToLimit(text: string, maxLen: number, ensureSentence = false): string {
  const sanitized = sanitizePlainText(text);
  if (sanitized.length <= maxLen) {
    if (ensureSentence && !sanitized.endsWith(".")) {
      return sanitized + ".";
    }
    return sanitized;
  }

  // Need to truncate cleanly
  if (ensureSentence) {
    const slicePoint = maxLen - 1; // leave room for period
    const truncated = sanitized.slice(0, slicePoint).replace(/\s+\S*$/, "");
    return (truncated || sanitized.slice(0, slicePoint)) + ".";
  }

  return sanitized.slice(0, maxLen).replace(/\s+\S*$/, "") || sanitized.slice(0, maxLen);
}

export interface ComponentTextInputs {
  name: string;
  ecosystem: string;
  status: string;
  ruleCount: number;
  nextEvent?: { event: string; date: string } | null;
}

export function buildComponentText(inputs: ComponentTextInputs): { title: string; summary: string } {
  // Fixed template for title: "<name> (<ecosystem>) lifecycle"
  const rawTitle = `${inputs.name} (${inputs.ecosystem}) lifecycle`;
  const title = truncateToLimit(rawTitle, 70);

  // Fixed template for summary
  let rawSummary: string;
  if (inputs.nextEvent) {
    rawSummary = `${inputs.name} in ${inputs.ecosystem} has status ${inputs.status} with next event ${inputs.nextEvent.event} on ${inputs.nextEvent.date}.`;
  } else {
    rawSummary = `${inputs.name} in ${inputs.ecosystem} has lifecycle status ${inputs.status} with ${inputs.ruleCount} tracked rule(s).`;
  }
  const summary = truncateToLimit(rawSummary, 160, true);

  return { title, summary };
}

export interface RuleTextInputs {
  id: string;
  purl: string;
  event: string;
  vers: string;
  deadline?: string | undefined;
  replacement?: string | undefined;
}

export function buildRuleText(inputs: RuleTextInputs): { title: string; summary: string } {
  // Fixed template for title: "<id>: <event>"
  const rawTitle = `${inputs.id}: ${inputs.event}`;
  let title = truncateToLimit(rawTitle, 70);
  if (title.length > 70) {
    title = truncateToLimit(`${inputs.event} on ${inputs.vers}`, 70);
  }

  // Fixed template for summary
  let rawSummary: string;
  if (inputs.deadline && inputs.replacement) {
    rawSummary = `Rule ${inputs.id} marks ${inputs.purl} (${inputs.vers}) as ${inputs.event} on ${inputs.deadline} with replacement ${inputs.replacement}.`;
  } else if (inputs.deadline) {
    rawSummary = `Rule ${inputs.id} marks ${inputs.purl} (${inputs.vers}) as ${inputs.event} with deadline ${inputs.deadline}.`;
  } else if (inputs.replacement) {
    rawSummary = `Rule ${inputs.id} marks ${inputs.purl} (${inputs.vers}) as ${inputs.event} with replacement ${inputs.replacement}.`;
  } else {
    rawSummary = `Rule ${inputs.id} marks ${inputs.purl} (${inputs.vers}) as ${inputs.event}.`;
  }
  const summary = truncateToLimit(rawSummary, 160, true);

  return { title, summary };
}

export interface LineTextInputs {
  lineId: string;
  compName: string;
  status: string;
  endDate?: string | null | undefined;
}

export function buildLineText(inputs: LineTextInputs): { title: string; summary: string } {
  // Fixed template for title: "<compName> <lineId> release line"
  const rawTitle = `${inputs.compName} ${inputs.lineId} release line`;
  const title = truncateToLimit(rawTitle, 70);

  // Fixed template for summary
  let rawSummary: string;
  if (inputs.endDate) {
    rawSummary = `Release line ${inputs.lineId} for ${inputs.compName} has status ${inputs.status} with end date ${inputs.endDate}.`;
  } else {
    rawSummary = `Release line ${inputs.lineId} for ${inputs.compName} has status ${inputs.status} with no known end date.`;
  }
  const summary = truncateToLimit(rawSummary, 160, true);

  return { title, summary };
}

/** Quotes a JSON array for a Markdown directive's double-quoted attribute. */
export function directiveData(items: readonly unknown[]): string {
  return JSON.stringify(items)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
