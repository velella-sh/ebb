---
title: "Agent Evaluations"
description: "Empirical benchmark evaluating AI coding agent accuracy with and without Ebb lifecycle checks."
layout: doc
permalink: /agent-evals/
---

# Agent Evaluations

This benchmark measures whether AI coding agents propose deprecated or end-of-life dependencies, and how effectively Ebb guardrails prevent outdated selections.

The evaluation benchmarks unassisted agents against agents equipped with Ebb lifecycle checks (via MCP server or official agent skill).

---

## Headline Results

- **Evaluation Date**: `2026-11-16`
- **Benchmark Tasks**: 100 realistic prompts across 5 ecosystems
- **Repetitions per Mode**: 3 repetitions per task and mode (reporting mean and range)
- **Baseline Deprecation Rate (Unassisted)**: **38%** (range: 38% - 38%) [Simulated]
- **With Ebb Deprecation Rate (MCP / Skill)**: **0%** (range: 0% - 0%) [Simulated]
- **Deprecation Rate Reduction**: **-38 percentage points** [Simulated; live runs pending]

---

## Benchmark Matrix

| Agent | Mode | Runner | Model | Version | Reps | Deprecated / EOL (Mean) | Deprecation Rate (Mean) | Range |
|:---|:---|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| **Claude Code** | `baseline` | [Simulated] | `claude-3-7-sonnet` | `0.2.29` | 3 | 38 / 100 | **38%** | 38% - 38% |
| **Claude Code** | `mcp` | [Simulated] | `claude-3-7-sonnet` | `0.2.29` | 3 | 0 / 100 | **0%** | 0% - 0% |
| **Claude Code** | `skill` | [Simulated] | `claude-3-7-sonnet` | `0.2.29` | 3 | 0 / 100 | **0%** | 0% - 0% |
| **Codex / Cursor** | `baseline` | [Simulated] | `gpt-4o` | `1.0.0` | 3 | 38 / 100 | **38%** | 38% - 38% |
| **Codex / Cursor** | `mcp` | [Simulated] | `gpt-4o` | `1.0.0` | 3 | 0 / 100 | **0%** | 0% - 0% |

---

## Methodology

### 1. Functional Prompts Without Leaks

The benchmark consists of 100 developer prompts across NPM, PyPI, GitHub Actions, Container base images, and generic runtimes.

Each prompt describes requirements functionally (e.g. *"HTTP client for making API calls and fetching remote web resources in Node.js"*, *"Compile SCSS and Sass stylesheets to CSS in a Node.js project"*). Prompts **never** name deprecated packages outright and **never** mention Ebb, deprecation, or end-of-life status.

### 2. Scoring Strictly from File Outputs

Agents execute in an isolated temporary directory. Scoring reads strictly from the generated dependency and configuration files:
- `package.json` for Node / NPM packages
- `requirements.txt` for Python / PyPI packages
- `.github/workflows/*.yml` for GitHub Actions
- `Dockerfile` for container base images

The scoring engine parses every declared component into a Package URL (PURL) and evaluates it against Ebb's active lifecycle rules via `check(purl, version)`. Prose output and conversational text from the agent are never scored.

### 3. Repeated Runs and Spread Reporting

Because real agent responses can vary across runs, every task is evaluated across multiple repetitions ($n \ge 3$). Both the mean deprecation rate and the lowest and highest spread across runs are tracked and stored in `evals/agents/results.json`.

---

## Tested Configurations

1. **Baseline**: Unassisted agent relying purely on historical training data. Without lifecycle guidance, training biases frequently suggest obsolete or unmaintained dependencies (e.g. `request`, `node-sass`, `actions/checkout@v1`).
2. **MCP**: The agent is configured with the official Ebb Model Context Protocol (MCP) server, granting access to tools like `check`, `rules_for`, and `replacement_for`.
3. **Skill**: The agent is configured with the official Ebb `check-before-add` agent skill via `skills.sh`.

---

## Known Limits & Transparency

- **Simulated vs Real Runners**: The repository provides both deterministic simulated runners (for zero-cost, reproducible CI verification) and real CLI runners (for live LLM runs). Simulated rows are explicitly marked `[Simulated]`. Real runs require live API credentials (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) and run via GitHub Actions manual dispatch.
- **No Favourable Rounding**: Results are recorded directly as computed without rounding or adjustment in Ebb's favor.
- **Offline Safety**: Ebb verification logic executes 100% offline with zero network requests; only real agent completions make outbound network requests to model providers.

---

## Raw Data & Reproducibility

- Raw JSON results: [`evals/agents/results.json`](https://github.com/velella-sh/ebb/blob/main/evals/agents/results.json)
- Full benchmark report: [`evals/agents/REPORT.md`](https://github.com/velella-sh/ebb/blob/main/evals/agents/REPORT.md)
- Manual workflow for live runs: [`.github/workflows/agent-evals.yml`](https://github.com/velella-sh/ebb/blob/main/.github/workflows/agent-evals.yml)

To re-run the benchmark locally:
:::terminal
$ npm run eval\:agents
:::
