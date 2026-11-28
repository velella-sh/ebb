import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { type TimelineCard, type TimelineLine, renderTimelineCard } from "../../tools/cards/render.js";

const card: TimelineCard = {
  name: "Example & Co <Runtime>",
  asOf: "2026-11-28",
  sourceUrl: "https://example.org/releases?a=1&b=2",
  lines: [],
};

const short: TimelineLine = {
  id: "2.x",
  released: "2024-03-01",
  activeEnd: "2025-03-01",
  end: "2026-03",
  extendedEnd: "2027-03",
};

const predicted: TimelineLine = {
  id: "3.x",
  released: "2026-03-01",
  prediction: {
    predictedEnd: { date: "2029-03-01", low: "2028-11-01", high: "2029-07-01", precision: "day" },
    confidence: "medium",
  },
};

const cases = {
  short: { ...card, lines: [short] },
  long: { ...card, lines: Array.from({ length: 12 }, (_, index) => ({ ...short, id: `Example ${12 - index}` })) },
  empty: card,
  predicted: { ...card, lines: [predicted] },
};

const snapshots: Record<keyof typeof cases, string> = {
  short: "b9d90011b415ade048d87391900234559e35ff284191e1743ee575546681ff1b",
  long: "edddfa376f8926bfc93c87d2ff54a5fe2fcacc31b2beeca33ead96726af6f3cf",
  empty: "a29305e4ef6036ec3892e143b5b24230bd204c27d1ebf8ff826c065a2de1e268",
  predicted: "58b4660b5667a8d05a6bdfff2e8fbc04b10b21fd6f70a0765c35fa3d25d7aa5e",
};

for (const [name, input] of Object.entries(cases)) {
  test(`card SVG snapshot: ${name}`, () => {
    const svg = renderTimelineCard(input);
    assert.equal(createHash("sha256").update(svg).digest("hex"), snapshots[name as keyof typeof cases]);
    assert.match(svg, /Example &amp; Co &lt;Runtime&gt; lifecycle timeline/u);
    assert.match(svg, /href="https:\/\/example\.org\/releases\?a=1&amp;b=2"/u);
  });
}

test("cards mark phases, predictions and unsupported sources", () => {
  const svg = renderTimelineCard({ ...card, sourceUrl: "javascript:alert(1)", lines: [predicted, short] });
  assert.match(svg, /class="security segment".*class="extended segment"/u);
  assert.match(svg, /class="prediction segment".*class="prediction range"/u);
  assert.match(svg, /2029-03-01 predicted.*medium confidence/u);
  assert.match(svg, /range 2028-11-01 to 2029-07-01/u);
  assert.doesNotMatch(svg, /href=/u);
  const announced = renderTimelineCard({ ...card, lines: [{ ...predicted, end: "2028-09" }] });
  assert.match(announced, /Ends 2028-09/u);
  assert.doesNotMatch(announced, /medium confidence/u);
  assert.match(renderTimelineCard(cases.long), /Showing 8 of 12 release lines/u);
  assert.match(renderTimelineCard(cases.empty), /No release lines with dated evidence/u);
});
