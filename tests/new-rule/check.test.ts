import assert from "node:assert/strict";
import { test } from "node:test";

import type { RegistryV2Rule } from "../../src/registry.js";
import { inspectSources } from "../../tools/new-rule-check.js";

const dated: RegistryV2Rule = {
  id: "nodejs.runtime.example",
  ecosystem: "nodejs",
  purl: "pkg:generic/nodejs",
  vers: "vers:semver/>=20.0.0|<21.0.0",
  event: "end-of-life",
  title: "Recorded Node.js evidence",
  summary: "Fixture",
  severity: "low",
  deadline: "2026-04-30",
  sources: [{ title: "Schedule", url: "https://nodejs.org/about", accessedAt: "2026-10-01" }],
  provenance: { observedAt: "2026-10-01", reviewedAt: "2026-10-01", reviewer: "ebb-example", method: "manual" },
};

test("source checks report the claimed date, missing date, archive request outcome, and unreachability", async () => {
  const url = "https://nodejs.org/about";
  const requested: string[] = [];
  const archive = async (value: string) => {
    requested.push(value);
    return "requested (HTTP 302)";
  };
  assert.deepEqual(await inspectSources(dated, async () => "<div>April 30, 2026</div>", archive), [
    [url, "reachable", "found 2026-04-30", "requested (HTTP 302)"],
  ]);
  assert.deepEqual(requested, [url]);
  assert.deepEqual(
    await inspectSources(
      dated,
      async () => "another date",
      () => Promise.reject(new Error()),
    ),
    [[url, "reachable", "could not find 2026-04-30", "request failed"]],
  );
  assert.deepEqual(await inspectSources(dated, () => Promise.reject(new Error()), archive), [
    [url, "unreachable", "unverified", "skipped (unreachable)"],
  ]);
  assert.deepEqual(requested, [url]);
});
