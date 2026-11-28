import type { CoverageWeek } from "./history.js";

const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/gu,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!,
  );

export function renderCoverageCard(week: CoverageWeek, mark: string): string {
  // The mark is the repository's own static SVG; embed its paths so the card is self-contained.
  const brand = /^<svg\b[^>]*>([\s\S]*)<\/svg>$/u.exec(mark.trim())?.[1];
  if (!brand) throw new Error("Expected the repository's SVG Ebb mark.");
  const figures = [
    ["Rules", week.rules],
    ["Components", week.components],
    ["Gaps", week.gaps],
  ] as const;
  const labels = figures.map(
    ([label, count], i) =>
      `    <text x="${72 + i * 380}" y="444" fill="#3F6E66" font-size="102" font-weight="700">${count}</text>
    <text x="${72 + i * 380}" y="510" fill="#26221E" font-size="34">${label}</text>`,
  );
  const title = `Ebb data coverage · Week of ${week.week}`;
  const description = `${week.rules} rules, ${week.components} components, ${week.gaps} recorded gaps. Signed data ${week.dataVersion} as of ${week.asOf} UTC.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="coverage-title coverage-desc">
  <title id="coverage-title">${escapeXml(title)}</title>
  <desc id="coverage-desc">${escapeXml(description)}</desc>
  <rect width="1200" height="630" fill="#F7F2E8"/>
  <g transform="translate(1012 49) scale(1.1)" aria-hidden="true">${brand.replace(/<title>[^<]*<\/title>/gu, "")}</g>
  <g font-family="system-ui, sans-serif">
    <text x="72" y="120" fill="#3F6E66" font-size="34">Week of ${escapeXml(week.week)}</text>
    <text x="72" y="226" fill="#26221E" font-size="72" font-weight="700">Ebb data coverage</text>
    <path d="M72 293h1056" stroke="#CBCEC1" stroke-width="2"/>
${labels.join("\n")}
    <text x="72" y="580" fill="#555D54" font-size="26">Signed data ${escapeXml(week.dataVersion)} · ${escapeXml(week.asOf)} UTC</text>
  </g>
</svg>
`;
}
