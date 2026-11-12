import assert from "node:assert/strict";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import type * as ActionMain from "../action/main.js";

const actionPath = pathToFileURL(resolve(process.cwd(), "action/main.js")).href;
const { runAction, formatAnnotation, shouldFail } = (await import(actionPath)) as typeof ActionMain;

function createMockIo() {
  let stdoutData = "";
  let stderrData = "";

  const stdout = {
    write(str: string) {
      stdoutData += str;
      return true;
    },
  };

  const stderr = {
    write(str: string) {
      stderrData += str;
      return true;
    },
  };

  return {
    io: { stdout, stderr },
    get stdout() {
      return stdoutData;
    },
    get stderr() {
      return stderrData;
    },
  };
}

describe("GitHub Action (action/main.js)", () => {
  it("computes shouldFail according to severity threshold", () => {
    assert.equal(shouldFail("ok", "deprecated"), false);
    assert.equal(shouldFail("scheduled", "deprecated"), false);
    assert.equal(shouldFail("scheduled", "scheduled"), true);
    assert.equal(shouldFail("deprecated", "deprecated"), true);
    assert.equal(shouldFail("deprecated", "unsupported"), false);
    assert.equal(shouldFail("deprecated", "none"), false);
  });

  it("formats GitHub Workflow annotations correctly", () => {
    const errAnnotation = formatAnnotation(
      "deprecated",
      "pkg:npm/request@2.88.2",
      "Rule: npm-request-deprecated. Replacement: pkg:npm/axios",
    );
    assert.equal(
      errAnnotation,
      "::error title=Ebb Lifecycle Finding::pkg:npm/request@2.88.2: deprecated - Rule: npm-request-deprecated. Replacement: pkg:npm/axios",
    );

    const warnAnnotation = formatAnnotation("scheduled", "pkg:generic/node@22.0.0", "Rule: node-22-eol.");
    assert.equal(
      warnAnnotation,
      "::warning title=Ebb Lifecycle Notice::pkg:generic/node@22.0.0: scheduled - Rule: node-22-eol.",
    );
  });

  it("fails with exit code 2 when neither purls nor file is provided", () => {
    const mock = createMockIo();
    const code = runAction({}, mock.io);
    assert.equal(code, 2);
    assert.ok(mock.stderr.includes("Either 'purls' or 'file' input must be provided"));
  });

  it("passes cleanly on supported packages and writes summary", () => {
    const summaryPath = resolve(tmpdir(), `summary-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
    const mock = createMockIo();
    const code = runAction(
      {
        INPUT_PURLS: "pkg:npm/axios@1.6.0\npkg:docker/library/node@24.0.0",
        INPUT_FAIL_ON: "deprecated",
        GITHUB_STEP_SUMMARY: summaryPath,
      },
      mock.io,
    );

    assert.equal(code, 0);
    assert.ok(mock.stdout.includes("Ebb Lifecycle Check Summary"));
    assert.ok(mock.stdout.includes("Total Checked"));

    const summaryContent = readFileSync(summaryPath, "utf8");
    assert.ok(summaryContent.includes("Ebb Lifecycle Check Summary"));
    unlinkSync(summaryPath);
  });

  it("detects deprecated packages, emits annotation, and fails on threshold", () => {
    const summaryPath = resolve(tmpdir(), `summary-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
    const mock = createMockIo();
    const code = runAction(
      {
        INPUT_PURLS: "pkg:npm/request@2.88.2",
        INPUT_FAIL_ON: "deprecated",
        GITHUB_STEP_SUMMARY: summaryPath,
      },
      mock.io,
    );

    assert.equal(code, 1);
    // Emits workflow annotation
    assert.ok(mock.stdout.includes("::error title=Ebb Lifecycle Finding::"));
    assert.ok(mock.stdout.includes("pkg:npm/request@2.88.2"));

    // Summary includes findings and Offing remediation hint
    const summaryContent = readFileSync(summaryPath, "utf8");
    assert.ok(summaryContent.includes("Offing can fix this"));
    unlinkSync(summaryPath);
  });

  it("respects fail-on none for findings", () => {
    const mock = createMockIo();
    const code = runAction(
      {
        INPUT_PURLS: "pkg:npm/request@2.88.2",
        INPUT_FAIL_ON: "none",
      },
      mock.io,
    );

    // Code is 0 because fail-on is none
    assert.equal(code, 0);
    // Annotation is still emitted
    assert.ok(mock.stdout.includes("::error title=Ebb Lifecycle Finding::"));
  });

  it("disables remediation hint when INPUT_NO_HINT=true", () => {
    const summaryPath = resolve(tmpdir(), `summary-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
    const mock = createMockIo();
    runAction(
      {
        INPUT_PURLS: "pkg:npm/request@2.88.2",
        INPUT_NO_HINT: "true",
        GITHUB_STEP_SUMMARY: summaryPath,
      },
      mock.io,
    );

    const summaryContent = readFileSync(summaryPath, "utf8");
    assert.equal(summaryContent.includes("Offing can fix this"), false);
    unlinkSync(summaryPath);
  });
});
