import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import {
  checkSources,
  DEAD_SOURCE_LABELS,
  DEAD_SOURCE_MARKER_PREFIX,
  extractDeadSourceHash,
  extractRuleVersionTokens,
  failingCategories,
  fetchObservation,
  formatDeadSourceMarker,
  isBotChallenge,
  main,
  openDeadSourceIssues,
  renderDeadSourceIssue,
  renderSummary,
  updatedLock,
} from "../tools/check-sources.js";
import type { IssueRunner, SourceLock, SourceObservation } from "../tools/check-sources.js";
import type { RegistryV2, RegistryV2Rule } from "../src/registry.js";

const NOW = new Date("2026-10-15T12:00:00Z");

function rule(id: string, urls: string[], reviewedAt = "2026-10-01"): RegistryV2Rule {
  return {
    id,
    ecosystem: "npm",
    purl: `pkg:npm/${id.split(".")[2] ?? "x"}`,
    vers: "vers:npm/*",
    event: "deprecated",
    title: "T",
    summary: "S",
    severity: "high",
    sources: urls.map((url) => ({ title: "Source", url })),
    provenance: { observedAt: "2026-09-01", reviewedAt, reviewer: "maintainer", method: "manual" },
  };
}

function registry(rules: RegistryV2Rule[], maxReviewAgeDays?: number): { name: string; registry: RegistryV2 } {
  return {
    name: "npm",
    registry: {
      schemaVersion: "ebb.registry.v2",
      ecosystem: "npm",
      ...(maxReviewAgeDays ? { freshness: { maxReviewAgeDays } } : {}),
      rules,
    },
  };
}

const page = (url: string, title: string | null = "Page", status = 200): SourceObservation => ({
  status,
  finalUrl: url,
  title,
});
const lockOf = (entries: Record<string, { finalUrl: string; title: string | null }>): SourceLock => ({
  schemaVersion: "ebb.source-lock.v1",
  sources: Object.fromEntries(
    Object.entries(entries).map(([url, entry]) => [url, { ...entry, checkedAt: "2026-10-01" }]),
  ),
});

test("reports nothing to review when every source is unchanged and every rule is fresh", async () => {
  const url = "https://example.com/a";
  const { report } = await checkSources({
    registries: [registry([rule("npm.package.a.deprecated", [url])])],
    lock: lockOf({ [url]: { finalUrl: url, title: "Page" } }),
    now: NOW,
    observe: async (u) => page(u),
  });
  assert.deepEqual(
    {
      ok: report.ok,
      stale: report.stale,
      changed: report.changed,
      unreachable: report.unreachable,
      blocked: report.blocked,
      unrecorded: report.unrecorded,
    },
    {
      ok: 1,
      stale: [],
      changed: [],
      unreachable: [],
      blocked: [],
      unrecorded: [],
    },
  );
  assert.equal(report.sources, 1);
  assert.equal(report.rules, 1);
  assert.deepEqual(failingCategories(report, ["stale", "changed", "unreachable"]), []);
});

test("reports stale rules separately from source problems", async () => {
  const url = "https://example.com/a";
  const { report } = await checkSources({
    registries: [
      registry(
        [
          rule("npm.package.old.deprecated", [url], "2025-01-01"),
          rule("npm.package.new.deprecated", [url], "2026-10-10"),
        ],
        90,
      ),
    ],
    lock: lockOf({ [url]: { finalUrl: url, title: "Page" } }),
    now: NOW,
    observe: async (u) => page(u),
  });
  assert.deepEqual(
    report.stale.map((entry) => [entry.registry, entry.ruleId, entry.maxReviewAgeDays]),
    [["npm", "npm.package.old.deprecated", 90]],
  );
  assert.equal(report.changed.length + report.unreachable.length, 0);
  assert.deepEqual(failingCategories(report, ["stale", "changed", "unreachable"]), ["stale"]);
});

test("reports moved and retitled sources as changed, with the reason", async () => {
  const moved = "https://example.com/moved";
  const retitled = "https://example.com/retitled";
  const both = "https://example.com/both";
  const { report } = await checkSources({
    registries: [registry([rule("npm.package.a.deprecated", [moved, retitled, both])])],
    lock: lockOf({
      [moved]: { finalUrl: moved, title: "Same" },
      [retitled]: { finalUrl: retitled, title: "Before" },
      [both]: { finalUrl: both, title: "Before" },
    }),
    now: NOW,
    observe: async (url) =>
      url === moved
        ? page("https://example.com/new-home", "Same")
        : url === retitled
          ? page(url, "After")
          : page("https://example.com/other", "After"),
  });
  assert.deepEqual(
    report.changed.map((entry) => [entry.url, entry.reasons]),
    [
      [both, ["final-url", "title"]],
      [moved, ["final-url"]],
      [retitled, ["title"]],
    ],
  );
  assert.equal(report.changed[0]!.recorded.title, "Before");
  assert.equal(report.changed[0]!.current.finalUrl, "https://example.com/other");
  assert.equal(report.ok, 0);
});

test("ignores differences that are not real changes", async () => {
  const url = "https://Example.com/a/#section";
  const { report } = await checkSources({
    registries: [registry([rule("npm.package.a.deprecated", [url])])],
    lock: lockOf({ [url]: { finalUrl: "https://example.com/a", title: "A   Page" } }),
    now: NOW,
    observe: async () => page("https://example.com/a/", " A Page "),
  });
  assert.equal(report.ok, 1);
  assert.equal(report.changed.length, 0);
});

test("separates unreachable, blocked, and unrecorded sources", async () => {
  const urls = [
    "https://example.com/gone",
    "https://example.com/error",
    "https://example.com/down",
    "https://example.com/challenge",
    "https://example.com/forbidden",
    "https://example.com/fresh",
  ];
  const { report } = await checkSources({
    registries: [registry([rule("npm.package.a.deprecated", urls)])],
    lock: lockOf({}),
    now: NOW,
    observe: async (url) => {
      if (url.endsWith("gone")) return page(url, "Not Found", 404);
      if (url.endsWith("error")) return page(url, "Oops", 500);
      if (url.endsWith("down")) return { status: null, finalUrl: null, title: null, error: "fetch failed" };
      if (url.endsWith("challenge")) return page(url, "Just a moment...", 403);
      if (url.endsWith("forbidden")) return page(url, "Forbidden", 403);
      return page(url);
    },
  });
  assert.deepEqual(
    report.unreachable.map((entry) => [entry.url.split("/").pop(), entry.reason]),
    [
      ["down", "fetch failed"],
      ["error", "HTTP 500"],
      ["forbidden", "HTTP 403"],
      ["gone", "HTTP 404"],
    ],
  );
  assert.deepEqual(
    report.blocked.map((entry) => entry.url.split("/").pop()),
    ["challenge"],
  );
  assert.deepEqual(
    report.unrecorded.map((entry) => entry.url.split("/").pop()),
    ["fresh"],
  );
  assert.deepEqual(failingCategories(report, ["stale", "changed", "unreachable"]), ["unreachable"]);
});

test("recognizes bot challenges by blocking status or a challenge page title", () => {
  assert.equal(isBotChallenge(page("u", "Just a moment...", 403)), true);
  assert.equal(isBotChallenge(page("u", "Attention Required! | Cloudflare", 503)), true);
  assert.equal(isBotChallenge(page("u", "403 Oracle Export Error", 403)), true);
  assert.equal(isBotChallenge(page("u", "Technical Difficulties", 403)), true);
  assert.equal(isBotChallenge(page("u", "403 Oracle Export Error", 200)), false);
  assert.equal(isBotChallenge(page("u", "Technical Difficulties", 200)), false);
  assert.equal(isBotChallenge(page("u", "Client Challenge", 200)), true);
  assert.equal(isBotChallenge(page("u", "Just a moment...", 200)), false);
  assert.equal(isBotChallenge(page("u", "Forbidden", 403)), false);
  assert.equal(isBotChallenge({ status: null, finalUrl: null, title: null }), false);
});

test("fetches each shared URL once and lists every rule that cites it", async () => {
  const shared = "https://example.com/shared";
  const calls: string[] = [];
  const { report } = await checkSources({
    registries: [
      registry([
        rule("npm.package.b.deprecated", [shared]),
        rule("npm.package.a.deprecated", [shared, "https://example.com/own"]),
      ]),
    ],
    lock: lockOf({}),
    now: NOW,
    observe: async (url) => {
      calls.push(url);
      return page(url);
    },
  });
  assert.deepEqual([...calls].sort(), ["https://example.com/own", shared]);
  assert.deepEqual(report.unrecorded.find((entry) => entry.url === shared)?.ruleIds, [
    "npm.package.a.deprecated",
    "npm.package.b.deprecated",
  ]);
  assert.equal(report.sources, 2);
});

test("produces the same report regardless of fetch completion order and honors the concurrency limit", async () => {
  const urls = Array.from({ length: 12 }, (_, index) => `https://example.com/p${index}`);
  let running = 0;
  let peak = 0;
  const run = async (delay: (index: number) => number) => {
    const { report } = await checkSources({
      registries: [registry([rule("npm.package.a.deprecated", urls)])],
      lock: lockOf({}),
      now: NOW,
      concurrency: 3,
      observe: async (url) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, delay(urls.indexOf(url))));
        running--;
        return page(url);
      },
    });
    return JSON.stringify(report);
  };
  assert.equal(await run((index) => index), await run((index) => 12 - index));
  assert.ok(peak <= 3, `peak concurrency ${peak}`);
});

test("accepting an observation records reachable pages and keeps earlier entries for failures", () => {
  const ok = "https://example.com/ok";
  const down = "https://example.com/down";
  const removed = "https://example.com/removed";
  const lock = lockOf({
    [ok]: { finalUrl: ok, title: "Old" },
    [down]: { finalUrl: down, title: "Kept" },
    [removed]: { finalUrl: removed, title: "No longer cited" },
  });
  const next = updatedLock(
    lock,
    new Map<string, SourceObservation>([
      [ok, page("https://example.com/ok-new", "New")],
      [down, { status: 500, finalUrl: down, title: "Oops" }],
    ]),
    NOW,
  );
  assert.deepEqual(next.sources, {
    [down]: lock.sources[down],
    [ok]: { finalUrl: "https://example.com/ok-new", title: "New", checkedAt: "2026-10-15" },
  });
});

test("a challenge page served with 200 never replaces the recorded title", () => {
  const url = "https://example.com/challenged";
  const lock = lockOf({ [url]: { finalUrl: url, title: "Real page" } });
  const next = updatedLock(lock, new Map<string, SourceObservation>([[url, page(url, "Client Challenge")]]), NOW);
  assert.deepEqual(next.sources, { [url]: lock.sources[url] });
});

test("renders a summary a maintainer can act on", async () => {
  const { report } = await checkSources({
    registries: [registry([rule("npm.package.a.deprecated", ["https://example.com/gone"], "2024-01-01")])],
    lock: lockOf({}),
    now: NOW,
    observe: async (url) => page(url, "Not Found", 404),
  });
  const text = renderSummary(report);
  assert.match(text, /\| Unreachable sources \| 1 \|/);
  assert.match(text, /\| Stale rules .* \| 1 \|/);
  assert.match(text, /`npm\.package\.a\.deprecated` \(npm\): reviewed 2024-01-01/);
  assert.match(text, /https:\/\/example\.com\/gone: HTTP 404; rules: `npm\.package\.a\.deprecated`/);
  assert.match(text, /Rules are never edited by this check/);
});

test("rejects unknown --fail-on categories before touching the network", async () => {
  await assert.rejects(main(["--fail-on", "everything"]), /Unknown --fail-on category "everything"/);
  await assert.rejects(main(["--out"]), /--out needs a value/);
  await assert.rejects(main(["registry"]), /Unexpected argument/);
});

test("fetchObservation follows redirects, reads the title, retries once, and reports failures", async (t) => {
  let flaky = 0;
  const server = createServer((request, response) => {
    const url = request.url ?? "/";
    if (url === "/page")
      return void response
        .writeHead(200, { "content-type": "text/html" })
        .end("<html><head><title>\n  Hello &amp;\n  World </title></head><body>x</body></html>");
    if (url === "/redirect") return void response.writeHead(302, { location: "/page" }).end();
    if (url === "/missing") return void response.writeHead(404).end("<title>Gone</title>");
    if (url === "/flaky")
      return void response
        .writeHead(++flaky === 1 ? 500 : 200, { "content-type": "text/html" })
        .end("<title>Recovered</title>");
    if (url === "/slow") return; // never answers
    if (url === "/plain") return void response.writeHead(200, { "content-type": "application/json" }).end('{"a":1}');
    response.writeHead(400).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  assert.deepEqual(await fetchObservation(`${base}/page`), {
    status: 200,
    finalUrl: `${base}/page`,
    title: "Hello &amp; World",
  });
  assert.deepEqual(await fetchObservation(`${base}/redirect`), {
    status: 200,
    finalUrl: `${base}/page`,
    title: "Hello &amp; World",
  });
  assert.deepEqual(await fetchObservation(`${base}/missing`), {
    status: 404,
    finalUrl: `${base}/missing`,
    title: "Gone",
  });
  assert.equal((await fetchObservation(`${base}/flaky`)).title, "Recovered");
  assert.equal((await fetchObservation(`${base}/plain`)).title, null);

  const slow = await fetchObservation(`${base}/slow`, 150);
  assert.equal(slow.status, null);
  assert.ok(slow.error);
  const refused = await fetchObservation("http://127.0.0.1:1/", 500);
  assert.equal(refused.status, null);
});

test("fetchObservation retries on 429 and respects Retry-After header with mock sleep", async (t) => {
  let attempts = 0;
  const sleeps: number[] = [];
  const server = createServer((_req, res) => {
    attempts++;
    if (attempts === 1) {
      res.writeHead(429, { "retry-after": "2" });
      res.end("Rate limited");
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<title>Success</title><body>Success</body>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const port = (server.address() as AddressInfo).port;
  const obs = await fetchObservation(
    `http://127.0.0.1:${port}/test`,
    5000,
    3,
    async (ms) => {
      sleeps.push(ms);
    },
    true,
  );
  assert.equal(obs.status, 200);
  assert.equal(obs.title, "Success");
  assert.equal(attempts, 2);
  assert.deepEqual(sleeps, [2000]);
});

test("detects redirects and missing version mentions in page body", async () => {
  const url = "https://example.com/node-18";
  const node18Rule: RegistryV2Rule = {
    id: "nodejs.runtime.eol-18",
    ecosystem: "nodejs",
    purl: "pkg:generic/nodejs",
    vers: "vers:npm/>=18.0.0|<19.0.0",
    event: "end-of-life",
    title: "Node 18 EOL",
    summary: "Node 18 is EOL",
    severity: "high",
    sources: [{ title: "Node 18 notice", url }],
    provenance: { observedAt: "2026-09-01", reviewedAt: "2026-09-01", reviewer: "maintainer", method: "manual" },
  };

  const tokens = extractRuleVersionTokens(node18Rule);
  assert.ok(tokens.includes("18.0.0"));
  assert.ok(tokens.includes("18"));

  // 1. Page with different finalUrl (redirected)
  const { report: rep1 } = await checkSources({
    registries: [
      { name: "nodejs", registry: { schemaVersion: "ebb.registry.v2", ecosystem: "nodejs", rules: [node18Rule] } },
    ],
    lock: lockOf({ [url]: { finalUrl: url, title: "Node 18" } }),
    now: NOW,
    observe: async () => ({
      status: 200,
      finalUrl: "https://example.com/home",
      title: "Node 18",
      contentSnippet: "Mentions Node 18 here",
    }),
  });
  assert.equal(rep1.changed.length, 1);
  assert.ok(rep1.changed[0]!.reasons.includes("final-url"));

  // 2. Page that dropped version 18 mention
  const { report: rep2 } = await checkSources({
    registries: [
      { name: "nodejs", registry: { schemaVersion: "ebb.registry.v2", ecosystem: "nodejs", rules: [node18Rule] } },
    ],
    lock: lockOf({ [url]: { finalUrl: url, title: "Generic Releases" } }),
    now: NOW,
    observe: async () => ({
      status: 200,
      finalUrl: url,
      title: "Generic Releases",
      contentSnippet: "We only talk about Node 22 and 24 here now.",
    }),
  });
  assert.equal(rep2.changed.length, 1);
  assert.ok(rep2.changed[0]!.reasons.includes("version-missing"));
});

test("stores health status (ok, changed) in updatedLock", () => {
  const urlOk = "https://example.com/ok";
  const urlChanged = "https://example.com/changed";
  const lock: SourceLock = {
    schemaVersion: "ebb.source-lock.v1",
    sources: {
      [urlOk]: { finalUrl: urlOk, title: "OK", checkedAt: "2026-10-01", status: "ok" },
      [urlChanged]: { finalUrl: urlChanged, title: "Old Title", checkedAt: "2026-10-01", status: "ok" },
    },
  };

  const obs = new Map<string, SourceObservation>([
    [urlOk, { status: 200, finalUrl: urlOk, title: "OK" }],
    [urlChanged, { status: 200, finalUrl: urlChanged, title: "New Title" }],
  ]);

  const report = {
    schemaVersion: "ebb.source-check.v1" as const,
    checkedAt: "2026-10-15T00:00:00Z",
    registries: 1,
    rules: 2,
    sources: 2,
    ok: 1,
    stale: [],
    duePromotion: [],
    unreachable: [],
    changed: [
      {
        url: urlChanged,
        reasons: ["title" as const],
        recorded: lock.sources[urlChanged]!,
        current: { finalUrl: urlChanged, title: "New Title" },
        ruleIds: ["rule.1"],
      },
    ],
    blocked: [],
    unrecorded: [],
  };

  const next = updatedLock(lock, obs, NOW, report);
  assert.equal(next.sources[urlOk]?.status, "ok");
  assert.equal(next.sources[urlChanged]?.status, "changed");
});

test("dead source issue generator and deduplication", async () => {
  const deadUrl = "https://example.com/dead";
  const entry = { url: deadUrl, reason: "HTTP 404", ruleIds: ["npm.package.foo.deprecated"] };
  const issue = renderDeadSourceIssue(entry);

  assert.ok(issue.title.includes("npm.package.foo.deprecated"));
  assert.ok(issue.body.includes(DEAD_SOURCE_MARKER_PREFIX));
  assert.ok(issue.body.includes(deadUrl));
  assert.deepEqual(issue.labels, DEAD_SOURCE_LABELS);

  const hash = extractDeadSourceHash(issue.body);
  assert.ok(hash);
  assert.equal(hash, extractDeadSourceHash(formatDeadSourceMarker(deadUrl)));

  // Test issue runner with deduplication
  const created: { title: string; body: string; labels: string[] }[] = [];
  const mockRunner: IssueRunner = {
    async listExisting() {
      return [{ title: "Existing", body: issue.body, state: "OPEN" }];
    },
    async createIssue(iss) {
      created.push(iss);
      return 1;
    },
  };

  const report = {
    schemaVersion: "ebb.source-check.v1" as const,
    checkedAt: "2026-10-15T00:00:00Z",
    registries: 1,
    rules: 1,
    sources: 1,
    ok: 0,
    stale: [],
    duePromotion: [],
    unreachable: [entry],
    changed: [],
    blocked: [],
    unrecorded: [],
  };

  // Should skip because already tracked in existing
  const res1 = await openDeadSourceIssues(report, mockRunner, { maxOpen: 5 });
  assert.equal(res1.opened.length, 0);
  assert.equal(res1.skipped.length, 1);
  assert.equal(created.length, 0);

  // When not existing, it should create
  const emptyRunner: IssueRunner = {
    async listExisting() {
      return [];
    },
    async createIssue(iss) {
      created.push(iss);
      return 42;
    },
  };
  const res2 = await openDeadSourceIssues(report, emptyRunner, { maxOpen: 5 });
  assert.equal(res2.opened.length, 1);
  assert.equal(created.length, 1);
  assert.equal(res2.opened[0]?.url, deadUrl);
});
