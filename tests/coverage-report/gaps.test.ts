import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGaps, renderGaps } from "../../tools/coverage/gaps.js";
import type { ExpectedRuntime } from "../../tools/coverage/runtimes.js";
import { asOf, dataVersion, oldSource, rule } from "./fixture.js";

const runtime: ExpectedRuntime = {
  runtime: "nodejs",
  purl: "pkg:generic/nodejs",
  registry: "nodejs",
  scheduleUrl: "https://vendor.example.com/schedule",
  reviewedAt: "2026-11-01",
  sources: [],
  lines: [{ id: "20", sampleVersion: "20.0.0", lineVers: "vers:semver/>=20.0.0|<21.0.0", status: "ended" }],
};
const body = (purl: string, url: string) =>
  `### Product Name\n\nExample\n\n### Package URL (purl)\n\n${purl}\n\n### Authoritative Evidence URL\n\n${url}\n`;
const input = {
  asOf,
  rules: [rule("legacy", { replacement: "Nodejs 24 or later" })],
  runtimes: [runtime],
  freshness: { nodejs: 10 },
  sources: new Map([[oldSource, { status: "unreachable", archived: true }]]),
  requests: [
    {
      number: 3,
      title: "A new | package <script>",
      body: body("pkg:npm/new-product", "https://vendor.example.com/new-product"),
    },
    { number: 4, title: "Already covered", body: body("pkg:generic/nodejs", "https://vendor.example.com/existing") },
    { number: 5, title: "Missing identity", body: body("No package URL", "https://vendor.example.com/unknown") },
    { number: 6, title: "Invalid source", body: body("pkg:npm/another", "javascript:example") },
  ],
};

test("all five gap types keep evidence and offer the contribution form", () => {
  const result = buildGaps(input);
  assert.deepEqual(
    result.entries.map(({ kind }) => kind),
    ["runtime-line", "text-successor", "stale-rule", "dead-source", "requested-product", "requested-product"],
  );
  assert.equal(result.unresolvedRequests, 1);
  assert.equal(result.entries.at(-1)?.evidence, undefined);
  const page = renderGaps(result, asOf, dataVersion);
  assert.match(page, /https:\/\/vendor\.example\.com\/schedule/u);
  assert.match(page, /https:\/\/vendor\.example\.com\/new-product/u);
  assert.match(page, /template=new-product.yml/u);
  assert.match(page, /Existing request.*issues\/3/u);
  assert.ok(page.includes(String.raw`A new \| package \<script\>`));
  assert.doesNotMatch(page, /javascript:example|Already covered/u);
});

test("omits the request section when no input is available", () => {
  const result = buildGaps({ ...input, requests: undefined });
  const page = renderGaps(result, asOf, dataVersion);
  assert.doesNotMatch(page, /Requested products without rules/u);
  assert.match(page, /Open product requests were unavailable/u);
});
