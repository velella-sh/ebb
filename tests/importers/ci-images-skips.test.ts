import assert from "node:assert/strict";
import { test } from "node:test";

import { ciImagesImporter } from "../../tools/importers/ci-images-1.js";
import { RUNNER_IMAGES_README_URL } from "../../tools/importers/runner-images.js";
import type { ImporterContext } from "../../tools/importers/types.js";
import { ImporterError } from "../../tools/importers/types.js";

const badge = (issue: number) =>
  `[![deprecated](https://img.shields.io/badge/deprecated-E5534B)](https://github.com/actions/runner-images/issues/${issue})`;

function readme(rows: { image: string; label: string; issue: number }[]): string {
  const lines = rows.map((row) => `| ${row.image} ${badge(row.issue)} | x64 | \`${row.label}\` | [x] |`);
  return [
    "# runner-images",
    "",
    "## Available Images",
    "",
    "| Image | Architecture | YAML Label |",
    "| --- | --- | --- |",
    ...lines,
    "",
    "### Label scheme",
    "",
  ].join("\n");
}

function contextFor(rows: { image: string; label: string; issue: number }[], bodies: Record<number, unknown>) {
  const context: ImporterContext = {
    now: new Date("2026-10-15T12:00:00Z"),
    async fetchText(url) {
      if (url === RUNNER_IMAGES_README_URL) return readme(rows);
      const match = /issues\/(\d+)$/.exec(url);
      if (match && bodies[Number(match[1])] !== undefined) return JSON.stringify(bodies[Number(match[1])]);
      throw new ImporterError(`GET ${url} failed: HTTP 404`);
    },
  };
  return context;
}

test("throws when the README has no readable image table", async () => {
  const context: ImporterContext = {
    now: new Date("2026-10-15T12:00:00Z"),
    fetchText: async () => "# nothing here",
  };
  await assert.rejects(() => ciImagesImporter.import(context), /no Available Images table/);
});

test("skips a deprecated image that has no Azure Pipelines vmImage label", async () => {
  const context = contextFor([{ image: "macOS 14", label: "macos-14-large", issue: 1 }], {});
  const result = await ciImagesImporter.import(context);
  assert.deepEqual(result.rules, []);
  assert.deepEqual(result.notes, ["Skipped macOS 14 (issue #1): it has no Azure Pipelines vmImage label."]);
});

test("skips an announcement that does not list Azure DevOps as affected", async () => {
  const context = contextFor([{ image: "macOS 14", label: "macos-14", issue: 2 }], {
    2: { title: "t", body: "- [x] GitHub Actions\n- [ ] Azure DevOps\n" },
  });
  const result = await ciImagesImporter.import(context);
  assert.deepEqual(result.rules, []);
  assert.match(result.notes[0]!, /does not list Azure DevOps as affected/);
});

test("skips an announcement without a readable Retirement date", async () => {
  const context = contextFor([{ image: "macOS 14", label: "macos-14", issue: 3 }], {
    3: { title: "t", body: "- [x] Azure DevOps\n\n### Target date\nsoon\n" },
  });
  const result = await ciImagesImporter.import(context);
  assert.deepEqual(result.rules, []);
  assert.match(result.notes[0]!, /no readable Retirement date/);
});

test("skips an announcement that names no replacement label", async () => {
  const context = contextFor([{ image: "macOS 14", label: "macos-14", issue: 4 }], {
    4: { title: "t", body: "- [x] Azure DevOps\n\n### Target date\nRetirement: November 2, 2026\n" },
  });
  const result = await ciImagesImporter.import(context);
  assert.deepEqual(result.rules, []);
  assert.match(result.notes[0]!, /names no replacement label/);
});

test("drafts a rule and falls back to the issue URL when the announcement has no html_url", async () => {
  const context = contextFor([{ image: "macOS 14", label: "macos-14", issue: 5 }], {
    5: {
      body: [
        "- [x] Azure DevOps",
        "",
        "### Target date",
        "Retirement: November 2, 2026",
        "",
        "### Mitigation ways",
        "Replace `macos-14` with `macos-15`",
        "",
      ].join("\n"),
    },
  });
  const result = await ciImagesImporter.import(context);
  assert.equal(result.rules.length, 1);
  const rule = result.rules[0]!;
  assert.equal(rule.replacement, "macos-15");
  assert.equal(rule.sources[0]!.url, "https://github.com/actions/runner-images/issues/5");
  assert.match(rule.sources[0]!.title, /macOS 14 image retirement/);
});
