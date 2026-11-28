import assert from "node:assert/strict";
import { test } from "node:test";

import { growthSnapshot } from "../tools/growth-snapshot.js";

const now = new Date("2026-11-28T04:50:00Z");
const releases = {
  "api.github.com": { stargazers_count: 0, forks_count: 2 },
  "registry.npmjs.org": { "dist-tags": { latest: "0.2.0" } },
  "api.npmjs.org": { start: "2026-11-20", end: "2026-11-26", downloads: 187 },
};
const graph = `<strong>@velella/ebb</strong><a class="btn-link selected"
  href="/velella-sh/ebb/network/dependents?dependent_type=REPOSITORY">
  <svg aria-hidden="true"><path d="M5.97"/></svg>
  3 Repositories
</a>`;

test("records source counts and the download window from public responses", async () => {
  const { sources, ...snapshot } = await growthSnapshot(now, 7, async (url) => {
    const host = new URL(url).hostname;
    return host === "github.com" ? new Response(graph) : Response.json(releases[host as keyof typeof releases]);
  });
  assert.match(sources.githubDependents, /network\/dependents$/u);
  assert.deepEqual(snapshot, {
    date: "2026-11-28",
    recordedAt: "2026-11-28T04:50:00.000Z",
    stars: 0,
    forks: 2,
    npmLatest: "0.2.0",
    npmWeeklyDownloads: 187,
    npmWeeklyDownloadWindow: { start: "2026-11-20", end: "2026-11-26" },
    githubDependentRepositories: 3,
    npmDependentPackages: null,
    documentedIntegrations: 7,
  });
});

test("records unavailable counts as null and preserves an observed zero", async () => {
  const result = await growthSnapshot(now, 0, async (url) => {
    const host = new URL(url).hostname;
    if (host === "registry.npmjs.org") return Response.json({ dependents: 0 });
    if (host === "github.com") return new Response(graph.replace("@velella/ebb", "@velella/other"));
    if (host === "api.github.com") return new Response("rate-limited", { status: 429 });
    throw new Error("unavailable");
  });
  assert.deepEqual(
    [result.stars, result.forks, result.npmLatest, result.npmWeeklyDownloads, result.githubDependentRepositories],
    [null, null, null, null, null],
  );
  assert.equal(result.npmDependentPackages, 0);
  assert.equal(result.documentedIntegrations, 0);
});
