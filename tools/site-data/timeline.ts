import { isIsoDate, type RegistryV2Rule } from "../../src/registry.js";
import { addDays, addMonths, upcoming } from "../../src/upcoming.js";

function directiveData(items: readonly unknown[]): string {
  return JSON.stringify(items)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function releaseTimeline(lines: readonly { line: string; deadline: string | null; status: string }[]): string {
  // The signed registry records lifecycle deadlines. Release start dates are unknown.
  const items = lines.map(({ line, deadline, status }) => ({ label: line, start: null, end: deadline, status }));
  return `::timeline{items="${directiveData(items)}" caption="Release line support windows"}`;
}

export function deadlineMonths({
  asOf,
  version,
  rules,
  ruleSlugs,
}: {
  asOf: string;
  version: string;
  rules: readonly RegistryV2Rule[];
  ruleSlugs: ReadonlyMap<string, string>;
}) {
  if (!isIsoDate(asOf)) throw new Error(`Invalid site deadlines date: ${asOf}.`);
  const start = `${asOf.slice(0, 7)}-01`;
  const end = rules.reduce((latest, rule) => (rule.deadline && rule.deadline > latest ? rule.deadline : latest), start);
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
  const { items } = upcoming({ rules, asOf: start, within: days });
  const ordered = items.sort((a, b) =>
    a.deadline === b.deadline ? (a.ruleId < b.ruleId ? -1 : 1) : a.deadline < b.deadline ? -1 : 1,
  );
  const titleFormat = new Intl.DateTimeFormat("en", { timeZone: "UTC", month: "long", year: "numeric" });
  const months = [];
  for (let date = start; date <= end; date = addMonths(date, 1)) {
    const id = date.slice(0, 7);
    const next = addMonths(date, 1);
    const events = ordered.filter(({ deadline }) => deadline >= date && deadline < next);
    const entries = events.map(({ ruleId, title, deadline, datePrecision, event }) => {
      const slug = ruleSlugs.get(ruleId);
      if (!slug) throw new Error(`Missing signed rule page for deadline ${ruleId}.`);
      return {
        date: datePrecision === "month" ? id : deadline,
        label: title,
        status: event,
        url: `/ebb/rules/${slug}/`,
      };
    });
    const citations = new Map(events.flatMap(({ sources }) => sources.map((source) => [source.url, source.title])));
    const label = titleFormat.format(new Date(date));
    months.push({
      id,
      title: label,
      summary: `Lifecycle deadlines in ${label} from signed Ebb data ${version}.`,
      dataVersion: version,
      start: date,
      end: addDays(next, -1),
      count: events.length,
      agenda: `::dated-list{items="${directiveData(entries)}" start="${date}" months=1 level=3}`,
      claims: { agenda: [...citations].map(([url, title], index) => ({ id: `source-${index + 1}`, title, url })) },
    });
  }
  return months;
}
