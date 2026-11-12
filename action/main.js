#!/usr/bin/env node
/**
 * GitHub Action runner for @velella/ebb.
 *
 * Runs Ebb CLI check-all, produces GitHub Workflow annotations,
 * writes Markdown job summary to GITHUB_STEP_SUMMARY, and enforces fail-on threshold.
 */

import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const SEVERITY_LEVELS = {
  ok: 0,
  scheduled: 1,
  deprecated: 2,
  unsupported: 3,
  "end-of-life": 4,
  removed: 5,
  error: 6,
};

export function shouldFail(status, threshold = "deprecated") {
  if (threshold === "none" || threshold === "never") {
    return false;
  }
  const statusSev = SEVERITY_LEVELS[status] ?? 6;
  const threshSev = SEVERITY_LEVELS[threshold] ?? 2;
  return statusSev >= threshSev;
}

export function formatAnnotation(status, label, details) {
  const isErr = status !== "scheduled" && status !== "ok";
  const cmd = isErr ? "error" : "warning";
  const title = isErr ? "Ebb Lifecycle Finding" : "Ebb Lifecycle Notice";
  return `::${cmd} title=${title}::${label}: ${status} - ${details}`;
}

export function runAction(env = process.env, io = { stdout: process.stdout, stderr: process.stderr }) {
  const purlsInput = (env.INPUT_PURLS || "").trim();
  const fileInput = (env.INPUT_FILE || "").trim();
  const asOf = (env.INPUT_AS_OF || "").trim();
  const failOn = (env.INPUT_FAIL_ON || "deprecated").trim().toLowerCase();
  const noHint = env.INPUT_NO_HINT === "true" || env.INPUT_NO_HINT === "1";
  const summaryFile = env.GITHUB_STEP_SUMMARY;

  // Determine CLI entrypoint
  let cliPath = resolve(rootDir, "dist/src/cli.js");
  if (!existsSync(cliPath)) {
    cliPath = resolve(rootDir, "src/cli.ts");
  }

  // Determine input content
  let targetFile = fileInput;
  if (!targetFile && purlsInput) {
    const tmpFile = resolve(tmpdir(), `ebb-action-input-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(tmpFile, purlsInput, "utf8");
    targetFile = tmpFile;
  }

  if (!targetFile) {
    io.stderr.write("Error: Either 'purls' or 'file' input must be provided to velella-sh/ebb action.\n");
    return 2;
  }

  // 1. Run CLI for JSON output
  const jsonArgs = [cliPath, "check-all", targetFile, "--json"];
  if (asOf) jsonArgs.push("--as-of", asOf);
  if (noHint) jsonArgs.push("--no-hint");

  const jsonProc = spawnSync(process.execPath, jsonArgs, {
    encoding: "utf8",
    env: { ...env, NO_COLOR: "1" },
  });

  if (jsonProc.error) {
    io.stderr.write(`Failed to execute Ebb CLI: ${jsonProc.error.message}\n`);
    return 2;
  }

  let outcome;
  try {
    outcome = JSON.parse(jsonProc.stdout);
  } catch (err) {
    io.stderr.write(`Error parsing Ebb CLI output: ${jsonProc.stdout}\n${jsonProc.stderr}\n`);
    return 2;
  }

  // 2. Run CLI for Markdown output (Job Summary)
  const mdArgs = [cliPath, "check-all", targetFile, "--format", "markdown"];
  if (asOf) mdArgs.push("--as-of", asOf);
  if (noHint) mdArgs.push("--no-hint");

  const mdProc = spawnSync(process.execPath, mdArgs, {
    encoding: "utf8",
    env: { ...env, NO_COLOR: "1" },
  });

  const markdownSummary = mdProc.stdout || "";

  // Write to GITHUB_STEP_SUMMARY if available
  if (summaryFile && existsSync(dirname(summaryFile))) {
    try {
      appendFileSync(summaryFile, `${markdownSummary}\n`, "utf8");
    } catch {
      // Ignore summary write errors if path not writable
    }
  }

  // 3. Print human text or markdown to action log
  io.stdout.write(markdownSummary);

  // 4. Emit GitHub Workflow annotations
  let worstStatus = "ok";
  if (outcome.summary) {
    if (outcome.summary.errors > 0) worstStatus = "error";
    else if (outcome.summary.byStatus?.removed > 0) worstStatus = "removed";
    else if (outcome.summary.byStatus?.["end-of-life"] > 0) worstStatus = "end-of-life";
    else if (outcome.summary.byStatus?.unsupported > 0) worstStatus = "unsupported";
    else if (outcome.summary.byStatus?.deprecated > 0) worstStatus = "deprecated";
    else if (outcome.summary.byStatus?.scheduled > 0) worstStatus = "scheduled";
  }

  if (Array.isArray(outcome.results)) {
    for (const res of outcome.results) {
      if (res.status === "error") {
        io.stdout.write(`::error title=Ebb Error::[item ${res.index}] ${res.message}\n`);
      } else if (res.status && res.status !== "ok") {
        const matches = res.matches || [];
        const rep = matches.find((m) => m.replacement)?.replacement;
        const repText = rep ? ` Replacement: ${rep}` : "";
        const ruleIds = matches.map((m) => m.ruleId).join(", ");
        const detail = `Rule: ${ruleIds}.${repText}`;
        const label = res.purl ? `${res.purl}@${res.version || ""}` : "Component";
        io.stdout.write(`${formatAnnotation(res.status, label, detail)}\n`);
      }
    }
  }

  return shouldFail(worstStatus, failOn) ? 1 : 0;
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && process.argv[1].endsWith("/action/main.js"));

if (isMain) {
  const code = runAction(process.env, { stdout: process.stdout, stderr: process.stderr });
  process.exitCode = code;
}
