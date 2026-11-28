import type { EolPrediction } from "../../src/predict.js";

export const MAX_CARD_ROWS = 8;
export const CARD_MAX_BYTES = 12 * 1024;
export const CARDS_MAX_BYTES = 1024 * 1024;

export interface TimelineLine {
  id: string;
  released?: string | undefined;
  activeEnd?: string | undefined;
  end?: string | undefined;
  extendedEnd?: string | undefined;
  prediction?: Pick<EolPrediction, "predictedEnd" | "confidence"> | undefined;
}

export interface TimelineCard {
  name: string;
  asOf: string;
  sourceUrl?: string | undefined;
  lines: readonly TimelineLine[];
}

const WIDTH = 960;
const LEFT = 111;
const RIGHT = 701;
const TOP = 137;
const ROW_HEIGHT = 39;
const DAY = 86_400_000;

function xml(text: string): string {
  return text.replace(
    /[&<>"']/gu,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!,
  );
}

// A month is positioned on the axis at its first day while retaining its original precision in the labels.
function dateNumber(date: string): number {
  return Date.parse(date.length === 7 ? `${date}-01` : date);
}

function dates({ released, activeEnd, end, extendedEnd, prediction }: TimelineLine): string[] {
  const estimate = end ? undefined : prediction?.predictedEnd;
  return [released, activeEnd, end, extendedEnd, estimate?.low, estimate?.date, estimate?.high].filter(
    (date): date is string => date !== undefined,
  );
}

function predictionDate(prediction: NonNullable<TimelineLine["prediction"]>): string {
  const { date, precision } = prediction.predictedEnd;
  return precision === "month" ? date.slice(0, 7) : date;
}

function lineDescription({ id, released, activeEnd, end, extendedEnd, prediction }: TimelineLine): string {
  return [
    id,
    released ? `released ${released}` : "release date unknown",
    activeEnd ? `active support ends ${activeEnd}` : undefined,
    end ? `standard support ends ${end}` : "no announced end date",
    extendedEnd ? `extended support ends ${extendedEnd}` : undefined,
    !end && prediction
      ? `predicted end ${predictionDate(prediction)} (range ${prediction.predictedEnd.low} to ${prediction.predictedEnd.high}, ${prediction.confidence} confidence)`
      : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Renders self-contained SVG from explicit data. The latest eight rows are shown. */
export function renderTimelineCard({ name, asOf, lines, sourceUrl }: TimelineCard): string {
  const visible = lines.slice(0, MAX_CARD_ROWS);
  const plotHeight = Math.max(visible.length, 1) * ROW_HEIGHT;
  const bottom = TOP + plotHeight;
  const height = bottom + 86;
  const points = [asOf, ...visible.flatMap(dates)].map(dateNumber);
  const earliest = Math.min(...points);
  const latest = Math.max(...points);
  const padding = Math.max(DAY, (latest - earliest) * 0.025);
  const min = earliest - padding;
  const max = Math.max(latest + padding, min + 120 * DAY);
  const x = (day: number) => Math.round(LEFT + ((day - min) / (max - min)) * (RIGHT - LEFT));
  const at = (date: string) => x(dateNumber(date));
  const title = `${name} lifecycle timeline`;
  const heading = Array.from(name).length > 45 ? `${Array.from(name).slice(0, 44).join("")}…` : name;
  const omitted = lines.length > visible.length ? `Showing ${visible.length} of ${lines.length} release lines.` : "";
  const description = [
    `Build date ${asOf} UTC.`,
    omitted,
    ...visible.map((line) => `${lineDescription(line)}.`),
    visible.length ? "" : "No release lines with dated evidence.",
  ]
    .filter(Boolean)
    .join(" ");
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const day = min + ((max - min) * i) / 4;
    return `<line class="grid" x1="${x(day)}" x2="${x(day)}" y1="${TOP - 5}" y2="${bottom}"/><text class="muted" x="${x(day)}" y="${bottom + 19}" text-anchor="middle">${new Date(day).toISOString().slice(0, max - min <= 366 * DAY ? 10 : 7)}</text>`;
  });

  const rows = visible.map((line, index) => {
    const { id, released, activeEnd, end, extendedEnd } = line;
    const prediction = end ? undefined : line.prediction;
    const y = TOP + ROW_HEIGHT * index + 15;
    const segment = (phase: string, start: string | undefined, finish: string | undefined) =>
      start && finish && dateNumber(start) < dateNumber(finish)
        ? `<path class="${phase} segment" d="M${at(start)} ${y}H${at(finish)}"/>`
        : "";
    const dot = (phase: string, date: string | undefined) =>
      date ? `<circle class="${phase} dot" cx="${at(date)}" cy="${y}" r="4"/>` : "";
    const predicted = prediction?.predictedEnd;
    const support = [
      segment("standard", released, activeEnd ?? end),
      segment("security", activeEnd, end),
      segment("extended", end, extendedEnd),
    ].join("");
    const marks = [
      dot("standard", released),
      dot("security", activeEnd),
      dot("standard", end),
      dot("extended", extendedEnd),
    ].join("");
    const estimate = predicted
      ? [
          segment("prediction", activeEnd ?? released ?? predicted.low, predicted.date),
          `<path class="prediction range" d="M${at(predicted.low)} ${y + 9}H${at(predicted.high)}"/>`,
          dot("prediction", predicted.date),
        ].join("")
      : "";
    const label = end ? `Ends ${end}` : prediction ? `${predictionDate(prediction)} predicted` : "End date unknown";
    const detail = prediction
      ? `${prediction.confidence} confidence`
      : extendedEnd
        ? `Extended to ${extendedEnd}`
        : activeEnd
          ? `Maintenance from ${activeEnd}`
          : "";
    return `<g><title>${xml(lineDescription(line))}</title><text class="label" x="27" y="${y + 5}">${xml(id)}</text>${support}${marks}${estimate}<text x="725" y="${y + 4}">${xml(label)}</text><text class="muted" x="725" y="${y + 19}">${xml(detail)}</text></g>`;
  });
  // Links are useful when the SVG is opened directly. Embedded images cannot navigate.
  const source =
    sourceUrl && /^https:\/\/\S+$/u.test(sourceUrl)
      ? `<a href="${xml(sourceUrl)}"><text class="link" x="926" y="${height - 20}" text-anchor="end">Source evidence</text></a>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="card-title card-desc">
  <title id="card-title">${xml(title)}</title>
  <desc id="card-desc">${xml(description)}</desc>
  <style>
    svg { font-family:system-ui,sans-serif; font-size:14px; --background:#f7f2e8; --text:#26221e; --muted:#49594f; --grid:#cbd0c4; --standard:#3F6E66; --security:#548478; --extended:#6c537a; --prediction:#85481d; }
    @media (prefers-color-scheme:dark) { svg { --background:#1d2a27; --text:#f7f2e8; --muted:#c0cbc3; --grid:#526860; --standard:#7AA89F; --security:#a8cbbb; --extended:#d5b5e7; --prediction:#ffc08e; } }
    text { fill:var(--text); } .background { fill:var(--background); } .muted { fill:var(--muted); font-size:12px; }
    .label { font-weight:650; } .grid { stroke:var(--grid); } .reference { stroke:var(--text); stroke-dasharray:2 4; }
    .standard { color:var(--standard); } .security { color:var(--security); } .extended { color:var(--extended); } .prediction { color:var(--prediction); }
    .security.segment { stroke-width:4; } .extended.segment { stroke-width:5; }
    .segment, .range { stroke:currentColor; stroke-width:7; fill:none; } .prediction.segment { stroke-dasharray:6 5; stroke-width:3; }
    .range { stroke-width:1.5; } .dot { fill:currentColor; } .link { fill:var(--standard); text-decoration:underline; }
  </style>
  <rect class="background" width="${WIDTH}" height="${height}" rx="16"/>
  <path class="standard dot" aria-hidden="true" d="M29 26h29a3 3 0 0 1 0 6H29a3 3 0 0 1 0-6zm6 10h29a3 3 0 0 1 0 6H35a3 3 0 0 1 0-6zm6 10h29a3 3 0 0 1 0 6H41a3 3 0 0 1 0-6z"/>
  <text x="80" y="43" class="label">Ebb</text>
  <text x="27" y="86" class="label" font-size="28">${xml(heading)}</text>
  <text x="27" y="113">Release lifecycle</text>
  <text x="926" y="113" text-anchor="end" class="muted">Build date · ${xml(asOf)} UTC</text>
  <g aria-hidden="true">
    ${ticks.join("\n    ")}
    <line class="reference" x1="${at(asOf)}" x2="${at(asOf)}" y1="${TOP - 5}" y2="${bottom}"/>
    <path d="M${at(asOf) - 4} ${TOP - 9}h8l-4 6z" class="standard dot"/>
  </g>
  ${rows.length ? rows.join("\n  ") : '<text x="27" y="160">No release lines with dated evidence</text>'}
  <g aria-hidden="true">
    <path class="standard segment" d="M27 ${bottom + 42}h21"/><text x="57" y="${bottom + 47}">Standard</text>
    <path class="security segment" d="M157 ${bottom + 42}h21"/><text x="187" y="${bottom + 47}">Maintenance</text>
    <path class="extended segment" d="M305 ${bottom + 42}h21"/><text x="335" y="${bottom + 47}">Extended (optional)</text>
    <path class="prediction segment" d="M510 ${bottom + 42}h23"/><text x="543" y="${bottom + 47}">Predicted</text>
    <path class="reference" d="M668 ${bottom + 34}v17"/><text x="680" y="${bottom + 47}">Build date</text>
  </g>
  <text class="muted" x="27" y="${height - 20}">${xml(omitted)}</text>
  ${source}
</svg>
`;
}
