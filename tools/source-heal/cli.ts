// CLI runner for the Source Healer (sub-issue 7 & 8).
// Invoked as: node dist/tools/source-heal/cli.js [--report source-report.json] [--max-prs 5] [--dry-run]

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SourceReport } from "../check-sources.js";
import { loadRegistries, defaultGitHubRunner } from "../check-sources.js";
import { healDeadSource, applyHealToRegistry, formatHealPrBody, type HealReport } from "./index.js";

const execFileAsync = promisify(execFile);

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const options = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") {
      flags.add(arg);
    } else if (arg.startsWith("--")) {
      options.set(arg, argv[++i] ?? "");
    }
  }

  const reportPath = resolve(options.get("--report") ?? "source-report.json");
  const maxPrs = Number(options.get("--max-prs") ?? 3);
  const dryRun = flags.has("--dry-run");
  const registryDir = resolve(options.get("--registry-dir") ?? "registry");
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

  let report: SourceReport;
  try {
    const raw = await readFile(reportPath, "utf8");
    report = JSON.parse(raw) as SourceReport;
  } catch (err) {
    process.stderr.write(`Could not read report at ${reportPath}: ${(err as Error).message}\n`);
    return 1;
  }

  if (!report.unreachable || report.unreachable.length === 0) {
    process.stdout.write("No unreachable sources in report; nothing to heal.\n");
    return 0;
  }

  const registries = await loadRegistries(registryDir);
  const rulesMap = new Map<string, any[]>();
  for (const { registry } of registries) {
    for (const rule of registry.rules) {
      for (const s of rule.sources) {
        if (!rulesMap.has(s.url)) rulesMap.set(s.url, []);
        rulesMap.get(s.url)!.push(rule);
      }
    }
  }

  const existingIssues = await defaultGitHubRunner.listExisting();
  const issueNumberMap = new Map<string, number>();
  for (const issue of existingIssues) {
    if (issue.number) {
      for (const entry of report.unreachable) {
        if (issue.body.includes(entry.url)) {
          issueNumberMap.set(entry.url, issue.number);
        }
      }
    }
  }

  let prCount = 0;
  const healResults: HealReport[] = [];

  for (const unreachable of report.unreachable) {
    if (prCount >= maxPrs) break;
    const rules = rulesMap.get(unreachable.url) ?? [];
    process.stdout.write(`Attempting heal for ${unreachable.url}...\n`);

    const healReport = await healDeadSource(
      unreachable.url,
      rules,
      [{ timestamp: report.checkedAt, error: unreachable.reason }],
      {
        registryDir,
        ...(token ? { token } : {}),
      },
    );

    healResults.push(healReport);

    if (healReport.decision !== "unresolved" && healReport.candidate) {
      prCount++;
      const issueNum = issueNumberMap.get(unreachable.url);
      const prBody = formatHealPrBody(healReport, issueNum);
      const slug = unreachable.url.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30);
      const branch = `heal/source-${slug}`;

      process.stdout.write(`Healed: ${healReport.decision} -> ${healReport.candidate.url}\n`);

      if (!dryRun) {
        try {
          await execFileAsync("git", ["checkout", "-b", branch]);
          await applyHealToRegistry(healReport, registryDir);
          await execFileAsync("npm", ["run", "build:ecosystems"]);
          await execFileAsync("npm", ["run", "lint:rules"]);
          await execFileAsync("git", ["add", "registry/", "src/data/ecosystems/"]);
          await execFileAsync("git", [
            "commit",
            "-m",
            `data: heal dead source for ${healReport.ruleIds?.[0] ?? "rule"}`,
          ]);
          await execFileAsync("git", ["push", "-u", "origin", branch]);
          const prArgs = [
            "pr",
            "create",
            "--title",
            `data: heal dead source for ${healReport.ruleIds?.[0] ?? "rule"}`,
            "--body",
            prBody,
            "--head",
            branch,
          ];
          await execFileAsync("gh", prArgs);
          await execFileAsync("git", ["checkout", "main"]);
        } catch (e) {
          process.stderr.write(`Failed to open heal PR: ${(e as Error).message}\n`);
          await execFileAsync("git", ["checkout", "main"]).catch(() => undefined);
        }
      }
    }
  }

  process.stdout.write(`Heal completed. Opened ${prCount} heal PRs.\n`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith("cli.js")) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${(err as Error).stack ?? err}\n`);
      process.exit(1);
    },
  );
}
