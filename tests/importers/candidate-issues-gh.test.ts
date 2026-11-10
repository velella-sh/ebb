import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";

import { defaultGitHubRunner } from "../../tools/importers/candidate-issues.js";

/** Puts a fake `gh` first on PATH that records its arguments and prints whatever the test queued. */
async function withFakeGh(stdout: string, run: (argsFile: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "ebb-gh-"));
  const argsFile = join(dir, "args.txt");
  const script = join(dir, "gh");
  await writeFile(script, `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsFile}"\ncat <<'EOF'\n${stdout}\nEOF\n`);
  await chmod(script, 0o755);
  const originalPath = process.env.PATH;
  process.env.PATH = `${dir}${delimiter}${originalPath ?? ""}`;
  try {
    await run(argsFile);
  } finally {
    process.env.PATH = originalPath;
    await rm(dir, { recursive: true, force: true });
  }
}

const issue = { title: "T", body: "B", labels: ["candidate", "npm"] } as Parameters<
  typeof defaultGitHubRunner.createIssue
>[0];

test("listExistingIssues asks gh for every issue and parses the JSON", async () => {
  const issues = [{ number: 7, title: "x", body: "", state: "OPEN", labels: [] }];
  await withFakeGh(JSON.stringify(issues), async (argsFile) => {
    assert.deepEqual(await defaultGitHubRunner.listExistingIssues(), issues);
    const args = (await readFile(argsFile, "utf8")).trim().split("\n");
    assert.deepEqual(args.slice(0, 4), ["issue", "list", "--state", "all"]);
    assert.ok(!args.includes("--repo"));
  });
  await withFakeGh("[]", async (argsFile) => {
    await defaultGitHubRunner.listExistingIssues("o/r");
    assert.deepEqual((await readFile(argsFile, "utf8")).trim().split("\n").slice(-2), ["--repo", "o/r"]);
  });
});

test("createIssue returns the new issue's number and URL", async () => {
  await withFakeGh("https://github.com/o/r/issues/42", async (argsFile) => {
    assert.deepEqual(await defaultGitHubRunner.createIssue(issue, "o/r"), {
      number: 42,
      url: "https://github.com/o/r/issues/42",
    });
    const args = (await readFile(argsFile, "utf8")).trim().split("\n");
    assert.deepEqual(args.slice(0, 7), ["issue", "create", "--title", "T", "--body", "B", "--label"]);
    assert.equal(args[7], "candidate,npm");
    assert.deepEqual(args.slice(-2), ["--repo", "o/r"]);
  });
});

test("createIssue omits the number when gh prints something that is not an issue URL", async () => {
  await withFakeGh("created", async () => {
    assert.deepEqual(await defaultGitHubRunner.createIssue(issue), { url: "created" });
  });
});
