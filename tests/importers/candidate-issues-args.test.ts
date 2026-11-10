import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { main, processCandidateIssues } from "../../tools/importers/candidate-issues.js";
import type { CandidateIssueRunner } from "../../tools/importers/candidate-issues.js";

test("main rejects malformed options", async () => {
  await assert.rejects(main(["--max-open"]), /--max-open requires a number/);
  await assert.rejects(main(["--max-open", "abc"]), /--max-open must be a non-negative number/);
  await assert.rejects(main(["--max-open", "-1"]), /--max-open must be a non-negative number/);
  await assert.rejects(main(["--limit"]), /--limit requires a number/);
  await assert.rejects(main(["--limit", "x"]), /--limit must be a non-negative number/);
  await assert.rejects(main(["--out"]), /--out requires a directory path/);
  await assert.rejects(main(["--repo"]), /--repo requires an owner\/repo value/);
  await assert.rejects(main(["--bogus"]), /Unknown option --bogus/);
});

test("main requires one or two positional files", async () => {
  await assert.rejects(main([]), /Usage: candidate-issues/);
  await assert.rejects(main(["a", "b", "c"]), /Usage: candidate-issues/);
});

test("main treats a missing registry file as empty and reports the cap", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ebb-ci-args-"));
  const written: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => (written.push(String(chunk)), true)) as typeof process.stdout.write;
  try {
    const draftsPath = join(dir, "drafts.json");
    const rule = (name: string) => ({
      id: `npm.package.${name}.deprecated`,
      ecosystem: "npm",
      purl: `pkg:npm/${name}`,
      vers: "vers:npm/*",
      event: "deprecated",
      title: `${name} is deprecated`,
      summary: "Deprecated upstream.",
      severity: "high",
      replacement: "Use something else.",
      sources: [{ title: "npm", url: `https://www.npmjs.com/package/${name}` }],
    });
    await writeFile(
      draftsPath,
      JSON.stringify({ importer: "npm-deprecated", ecosystem: "npm", rules: [rule("aa"), rule("bb")], notes: [] }),
    );
    const runner: CandidateIssueRunner = {
      listExistingIssues: async () => [],
      createIssue: async () => ({ url: "https://github.com/o/r/issues/1" }),
    };
    const code = await main(
      [draftsPath, join(dir, "missing.json"), "--dry-run", "--max-open", "1", "--limit", "5", "--repo", "o/r"],
      runner,
    );
    assert.equal(code, 0);
    const output = written.join("");
    assert.match(output, /Evaluated/);
    assert.match(output, /cap/i);
  } finally {
    process.stdout.write = original;
    await rm(dir, { recursive: true, force: true });
  }
});

test("a dry run survives a failing issue listing, a real run does not, and no registry means an empty one", async () => {
  const failing: CandidateIssueRunner = {
    listExistingIssues: async () => {
      throw new Error("gh is not logged in");
    },
    createIssue: async () => ({ url: "unused" }),
  };
  const drafts = { importer: "npm-deprecated", ecosystem: "npm", rules: [], notes: [] } as never;
  const dry = await processCandidateIssues({ drafts, acknowledged: {}, dryRun: true, runner: failing });
  assert.deepEqual(dry.opened, []);
  await assert.rejects(processCandidateIssues({ drafts, acknowledged: {}, runner: failing }), /gh is not logged in/);
});
