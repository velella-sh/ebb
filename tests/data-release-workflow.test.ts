import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { parse } from "yaml";

import { DATA_SIGNER } from "../src/data-bundle.js";
import { appendReleaseLog } from "../src/data-release-log.js";

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
}
interface Workflow {
  on: {
    schedule?: Array<{ cron: string }>;
    push?: { tags?: string[] };
    workflow_dispatch?: {
      inputs?: Record<string, { default?: boolean; type?: string }>;
    };
  };
  permissions?: Record<string, string>;
  jobs: Record<
    string,
    {
      "runs-on"?: string;
      permissions?: Record<string, string>;
      env?: Record<string, string>;
      steps: Step[];
    }
  >;
}

const path = ".github/workflows/data-release.yml";
const workflow = parse(await readFile(resolve(path), "utf8")) as Workflow;
const job = workflow.jobs.release!;
const commands = job.steps.map((step) => step.run ?? "").join("\n");

test("it releases on data tags and weekly schedule, and a manual run is a dry run by default", () => {
  assert.deepEqual(workflow.on.push?.tags, ["data-v*"]);
  assert.equal(workflow.on.workflow_dispatch?.inputs?.dry_run?.default, true);
  assert.equal(workflow.on.workflow_dispatch?.inputs?.dry_run?.type, "boolean");
  // data-release-4: weekly schedule
  assert.ok(workflow.on.schedule && workflow.on.schedule.length > 0, "weekly schedule exists");
  const publish = job.steps.find((step) => step.run?.includes("gh release create"));
  assert.ok(publish, "a publish step exists");
  assert.match(publish.if ?? "", /github\.ref_type == 'tag'/, "tags publish");
  assert.match(publish.if ?? "", /github\.event_name == 'schedule'/, "scheduled runs publish");
});

test("the release job can read source artifacts and has the existing publishing permissions", () => {
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(job.permissions, {
    actions: "read",
    contents: "write",
    "id-token": "write",
    issues: "write",
    "pull-requests": "write",
  });
});

test("third-party actions are pinned to exact versions", () => {
  for (const item of Object.values(workflow.jobs)) {
    for (const step of item.steps.filter((s) => s.uses)) {
      // `./` and `$/` resolve inside this repository, so neither carries a pinned ref.
      if (step.uses!.startsWith("$/") || step.uses!.startsWith("./")) continue;
      assert.match(step.uses!, /^[\w./-]+@[0-9a-f]{40}$/, step.uses);
    }
  }
  assert.ok(job.steps.some((step) => step.uses?.startsWith("sigstore/cosign-installer@")));
});

test("the bundle is built twice, compared, and dated by the commit, not the clock", () => {
  assert.match(commands, /for run in a b/);
  assert.match(commands, /cmp out\/a\.json out\/b\.json/);
  assert.match(commands, /git log -1 --format=%cd --date=format-local/);
  assert.doesNotMatch(commands, /\bdate\b\s+-u|\$\(date/);
  assert.match(commands, /does not match the bundle version/);
  assert.match(commands, /npm run check|npm ci/);
});

test("the bundle is signed keylessly and verified against the signer identity before anything is published", () => {
  const signIndex = job.steps.findIndex((step) => step.run?.includes("cosign sign-blob"));
  const verifyIndex = job.steps.findIndex((step) => step.run?.includes("cosign verify-blob"));
  const publishIndex = job.steps.findIndex((step) => step.run?.includes("gh release create"));
  assert.ok(signIndex >= 0 && verifyIndex > signIndex && publishIndex > verifyIndex, "sign, then verify, then publish");
  assert.match(job.steps[signIndex]!.run!, /--yes --bundle "\$\{BUNDLE\}\.sigstore\.json"/);
  assert.doesNotMatch(commands, /--key\b|COSIGN_PRIVATE_KEY|COSIGN_PASSWORD/, "no long-lived keys");
  const verify = job.steps[verifyIndex]!.run!;
  assert.match(verify, /--certificate-oidc-issuer "\$\{OIDC_ISSUER\}"/);
  assert.match(verify, /--certificate-identity-regexp "\$\{IDENTITY_PATTERN\}"/);
});

test("the workflow and the verifier agree on who may sign", () => {
  assert.equal(job.env?.IDENTITY_PATTERN, DATA_SIGNER.identityPattern);
  assert.equal(job.env?.OIDC_ISSUER, DATA_SIGNER.issuer);
  const identity = new RegExp(DATA_SIGNER.identityPattern);
  const prefix = "https://github.com/velella-sh/ebb/.github/workflows/data-release.yml";
  for (const accepted of [
    `${prefix}@refs/tags/data-v2026.10.16`,
    `${prefix}@refs/tags/data-v2026.10.16.2`,
    `${prefix}@refs/heads/main`,
  ])
    assert.ok(identity.test(accepted), accepted);
  for (const rejected of [
    "https://github.com/velella-sh/ebb/.github/workflows/ci.yml@refs/heads/main",
    "https://github.com/someone/ebb/.github/workflows/data-release.yml@refs/heads/main",
    "https://github.com/someone/ebb-fork/.github/workflows/data-release.yml@refs/heads/main",
    `${prefix}@refs/heads/feature`,
    `${prefix}@refs/tags/v1.0.0`,
    `${prefix}@refs/tags/data-v2026.10.16-evil`,
    `${prefix}@refs/pull/12/merge`,
    `x${prefix}@refs/heads/main`,
  ])
    assert.equal(identity.test(rejected), false, rejected);
  assert.ok(path.endsWith("data-release.yml"));
});

test("it publishes the bundle, its signature, and checksums", () => {
  assert.match(
    commands,
    /sha256sum ebb-data-\*\.json ebb-data-\*\.sigstore\.json release-log\.jsonl release-log\.jsonl\.sigstore\.json > SHA256SUMS/,
  );
  assert.match(commands, /gh release create .* out\/\*/s);
  assert.match(commands, /--latest=false/, "a data bundle must never become the repository's Latest release");
  assert.match(commands, /--verify-tag/);
});

test("the release log is extended from the previous release, checked, signed, and published with the bundle", () => {
  assert.match(commands, /data-release-log\.js check previous-log\.jsonl/);
  assert.match(commands, /data-release-log\.js append previous-log\.jsonl/);
  assert.match(commands, /check out\/release-log\.jsonl --previous previous-log\.jsonl/);
  assert.match(
    commands,
    /cosign sign-blob --yes --bundle out\/release-log\.jsonl\.sigstore\.json out\/release-log\.jsonl/,
  );
  assert.match(commands, /sha256sum .*release-log\.jsonl/);
});

test("release-log-4: release workflow generates release notes and uses them as release body", () => {
  assert.match(commands, /data-release-notes\.js/);
  assert.match(commands, /--out out\/release-notes\.md/);
  assert.match(commands, /--json-diff out\/data-diff\.json/);
  assert.match(commands, /cat out\/release-notes\.md/);
  assert.match(commands, /--notes-file out\/release-notes\.md/);
});

test("data-release-4 & 2: detects whether data changed and stops early when unchanged", () => {
  assert.match(commands, /data-release-needed\.js/);
  assert.match(commands, /needed=\$\{STATUS\}/);
});

test("data-release-5: gates release on npm run lint:rules and source report date-changed findings", () => {
  assert.match(commands, /npm run lint:rules/);
  assert.match(commands, /date-changed/);
  assert.match(commands, /GITHUB_STEP_SUMMARY/);
});

test("data-release-6: verifies published release on clean machine with ebb update and ebb verify", () => {
  const verifyJob = workflow.jobs.verify;
  assert.ok(verifyJob, "verify job exists");
  assert.equal(verifyJob["runs-on"], "ubuntu-latest");
  const verifyCommands = verifyJob.steps.map((s) => s.run ?? "").join("\n");
  assert.match(verifyCommands, /npm install -g @velella\/ebb/);
  assert.match(verifyCommands, /ebb update/);
  assert.match(verifyCommands, /ebb verify/);
});

test("data-release-7: manages failure issue on scheduled runs and reuses existing open issue", () => {
  assert.match(commands, /<!-- data-release-failure -->/);
  assert.match(commands, /gh issue list/);
  assert.match(commands, /gh issue comment/);
  assert.match(commands, /gh issue create/);
  assert.match(commands, /gh issue close/);
});

test("data-release-8: prepares a patch pull request with fresh data after release", () => {
  assert.match(commands, /npm version patch --no-git-tag-version/);
  assert.match(commands, /gh pr create/);
  assert.match(commands, /--body-file out\/release-notes\.md/);
});

async function stepDirectory(t: TestContext): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ebb-release-step-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

function runStep(dir: string, commands: string, env: Record<string, string> = {}) {
  const useBuiltTools = 'node() { local entry="$1"; shift; command node "$TEST_ROOT/$entry" "$@"; }\n';
  return spawnSync("bash", ["-e", "-c", useBuiltTools + commands], {
    cwd: dir,
    encoding: "utf8",
    env: {
      PATH: dirname(process.execPath) + delimiter + (process.env.PATH ?? ""),
      TEST_ROOT: resolve("."),
      TMPDIR: dir,
      GITHUB_OUTPUT: join(dir, "output.txt"),
      GITHUB_STEP_SUMMARY: join(dir, "summary.txt"),
      ...env,
    },
  });
}

const versionStep = job.steps.find(({ name }) => name === "Work out the version")!.run!;
const sourceStep = job.steps.find(({ name }) => name === "Quality gate - source report date-changed")!.run!;

function logEntry(version: string): Parameters<typeof appendReleaseLog>[1] {
  return {
    version,
    contentDigest: "sha256:" + "a".repeat(64),
    bundleSha256: "sha256:" + "b".repeat(64),
    createdAt: version.split(".").slice(0, 3).join("-") + "T07:00:00Z",
  };
}

test("run 45668959310's first release that day produces valid GitHub outputs", {
  skip: process.platform === "win32",
}, async (t) => {
  const cwd = await stepDirectory(t);
  await writeFile(join(cwd, "previous-log.jsonl"), appendReleaseLog("", logEntry("2026.11.11")));
  const result = runStep(cwd, `git() { printf '%s\\n' '2026-11-21T07:03:01Z'; }\n${versionStep}`, {
    GITHUB_EVENT_NAME: "schedule",
    GITHUB_REF_TYPE: "branch",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(
    await readFile(join(cwd, "output.txt"), "utf8"),
    "created_at=2026-11-21T07:03:01Z\nrevision=\ntag=data-v2026.11.21\n",
  );
});

test("same-day scheduled and manual releases use the highest verified revision; dry runs and explicit tags keep their version path", {
  skip: process.platform === "win32",
}, async (t) => {
  const cwd = await stepDirectory(t);
  const log = ["2026.11.11", "2026.11.21", "2026.11.21.2", "2026.11.21.10"].reduce(
    (text, version) => appendReleaseLog(text, logEntry(version)),
    "",
  );
  const script = `git() { printf '%s\\n' '2026-11-21T07:03:01Z'; }\n${versionStep}`;
  const logPath = join(cwd, "previous-log.jsonl");
  await writeFile(logPath, log);
  for (const [env, suffix] of [
    [{ GITHUB_EVENT_NAME: "schedule", GITHUB_REF_TYPE: "branch" }, "revision=11\ntag=data-v2026.11.21.11\n"],
    [
      { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF_TYPE: "branch", DRY_RUN: "false" },
      "revision=11\ntag=data-v2026.11.21.11\n",
    ],
    [
      { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF_TYPE: "branch", DRY_RUN: "true" },
      "revision=\ntag=data-dry-run\n",
    ],
    [
      { GITHUB_EVENT_NAME: "push", GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "data-v2026.11.21.12" },
      "revision=12\ntag=data-v2026.11.21.12\n",
    ],
  ] as const) {
    await writeFile(join(cwd, "output.txt"), "");
    const result = runStep(cwd, script, env);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(join(cwd, "output.txt"), "utf8"), "created_at=2026-11-21T07:03:01Z\n" + suffix);
  }
  await writeFile(logPath, log.trimEnd());
  await writeFile(join(cwd, "output.txt"), "");
  const broken = runStep(cwd, script, { GITHUB_EVENT_NAME: "schedule", GITHUB_REF_TYPE: "branch" });
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /log must end with a newline/u);
  assert.equal(await readFile(join(cwd, "output.txt"), "utf8"), "");
});

test("the source gate selects one completed main run and rejects missing, invalid, and blocking reports", {
  skip: process.platform === "win32",
}, async (t) => {
  const cwd = await stepDirectory(t);
  const report = {
    schemaVersion: "ebb.source-check.v1",
    checkedAt: "2026-11-23T15:59:03.531Z",
    registries: 25,
    rules: 830,
    sources: 528,
    ok: 500,
    stale: [],
    duePromotion: [],
    unreachable: [],
    changed: [],
    blocked: [],
    unrecorded: [],
  };
  const script = `gh() {
    if [ "$*" = 'run list --workflow sources.yml --branch main --status completed --limit 1 --json databaseId --jq .[0].databaseId // empty' ]; then
      if [ "$SCENARIO" = 'no-runs' ]; then return; fi
      echo 45211235089
    elif [ "$1 $2 $3 $4 $5 $6" = 'run download 45211235089 --name source-report --dir' ]; then
      if [ "$SCENARIO" = 'no-artifact' ]; then return 1; fi
      cp source-report.json "$7/source-report.json"
    else
      printf 'Unexpected GitHub CLI command: %s\\n' "$*" >&2
      return 1
    fi
  }
  ${sourceStep}`;
  const fixture = join(cwd, "source-report.json");
  await writeFile(fixture, JSON.stringify({ ...report, "date-changed": [] }));
  const clear = runStep(cwd, script);
  assert.equal(clear.status, 0, clear.stderr);
  assert.match(clear.stdout, /45211235089 reported no date-changed findings/u);

  for (const [scenario, content, expected] of [
    ["no-runs", JSON.stringify(report), /No completed source freshness run/u],
    ["no-artifact", JSON.stringify(report), /no downloadable source-report artifact/u],
    ["bad-json", "{}", /has no valid source report/u],
    ["malformed-json", "{", /has no valid source report/u],
    ["missing-check", JSON.stringify(report), /has no valid source report/u],
    ["invalid-results", JSON.stringify({ ...report, "date-changed": "0" }), /has no valid source report/u],
    [
      "positive-findings",
      JSON.stringify({
        ...report,
        "date-changed": [
          {
            url: "https://example.com/evidence",
            ruleIds: ["fixture.rule"],
            expected: "2027-01-01",
            actual: "2027-02-01",
          },
        ],
      }),
      /reported 1 date-changed findings/u,
    ],
  ] as const) {
    await writeFile(fixture, content);
    await writeFile(join(cwd, "summary.txt"), "");
    const result = runStep(cwd, script, { SCENARIO: scenario });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, expected);
    assert.match(await readFile(join(cwd, "summary.txt"), "utf8"), expected);
  }
});
