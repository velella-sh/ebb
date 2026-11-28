import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import {
  DECLARATION_SCHEMA_URL,
  discoverDeclarations,
  main,
  publicSearchPage,
  searchUrl,
} from "../../tools/importers/declared-discover.js";
import { ImporterError } from "../../tools/importers/types.js";

const directory = "tests/importers/recordings";
const control = "https://json.schemastore.org/package.json";

test("prints public candidates from the real GitHub API control recording without a token", () => {
  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "dist/tools/importers/declared-discover.js",
        "--schema-url",
        control,
        "--replay",
        `${directory}/declared-discover.json`,
      ],
      { encoding: "utf8", env: { ...process.env, GH_TOKEN: "", GITHUB_TOKEN: "" } },
    ),
  );
  assert.equal(report.schemaUrl, control);
  assert.ok(report.candidates.length > 0);
  assert.ok(report.candidates.every((url: string) => /^https:\/\/api\.github\.com\/repositories\/\d+$/u.test(url)));
  assert.equal(new Set(report.candidates).size, report.candidates.length);
  assert.equal(report.incomplete, false);
});

test("replays the unpublished Ebb declaration search as a complete empty result", async () => {
  assert.deepEqual(await main(["--replay", `${directory}/declared-discover.json`], ""), {
    schemaUrl: DECLARATION_SCHEMA_URL,
    page: 1,
    candidates: [],
    incomplete: false,
    hasMore: false,
  });
});

test("keeps only unique public repository IDs and excludes repositories already in the list", async () => {
  const projection = publicSearchPage(
    {
      total_count: 52,
      incomplete_results: true,
      items: [
        { path: "hidden-owner", repository: { id: 3, private: true, owner: { login: "private-owner" } } },
        { repository: { id: 4, private: false, owner: { login: "public-owner" } } },
        { repository: { id: 4, private: false } },
        { repository: { id: 6 } },
        { repository: { id: 1450650180, private: false } },
      ],
    },
    1,
  );
  assert.deepEqual(projection, { repositoryIds: [4, 1450650180], incomplete: true, hasMore: true });
  const result = await discoverDeclarations({
    now: new Date("2026-11-28"),
    async fetchText(url) {
      assert.equal(new URL(url).searchParams.get("q"), `"${DECLARATION_SCHEMA_URL}" in:file`);
      return JSON.stringify(projection);
    },
  });
  assert.deepEqual(result.candidates, ["https://api.github.com/repositories/4"]);
  assert.equal(result.incomplete, true);
  assert.equal(result.hasMore, true);
});

test("keeps authorization errors and invalid inputs distinguishable from no matches", async () => {
  await assert.rejects(main([], ""), /Set GH_TOKEN/u);
  await assert.rejects(
    discoverDeclarations({
      now: new Date("2026-11-28"),
      async fetchText() {
        throw new ImporterError("GitHub code search failed: HTTP 403 (rate limit).");
      },
    }),
    /HTTP 403/u,
  );
  assert.throws(() => publicSearchPage({ message: "Requires authentication" }, 1), /invalid response/u);
  assert.throws(() => searchUrl("https://schema.example/test?token=unsafe", 1), /without credentials/u);
  assert.throws(() => searchUrl(DECLARATION_SCHEMA_URL, 0), /page from 1 to 34/u);
});
