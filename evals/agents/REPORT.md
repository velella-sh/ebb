# Ebb Agent Evaluations Report

> Benchmark evaluating AI coding agents on dependency and runtime selection tasks with and without Ebb lifecycle checks.

## Status

The evaluation benchmarks unassisted agents against agents equipped with Ebb lifecycle checks (via MCP server or official agent skill). Rows executed via simulated runners are explicitly labelled `[Simulated]`. Real runs are triggered through the manual GitHub Actions workflow with authenticated API credentials.

## Evaluation scope

- **Total benchmark tasks:** 100
- **Repetitions per mode:** 3 (mean and range reported across runs)

## Benchmark Matrix

Compare rows measured with the same runner and model. Simulated rows exercise the scoring pipeline and do not measure live agent accuracy.

| Agent | Mode | Runner | Model | Version | Reps | Deprecated / EOL (Mean) | Deprecation Rate (Mean) | Range |
|:---|:---|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| Claude Code | `baseline` | [Simulated] | claude-3-7-sonnet | 0.2.29 | 3 | 38 / 100 | **38%** | 38% - 38% |
| Claude Code | `mcp` | [Simulated] | claude-3-7-sonnet | 0.2.29 | 3 | 0 / 100 | **0%** | 0% - 0% |
| Claude Code | `skill` | [Simulated] | claude-3-7-sonnet | 0.2.29 | 3 | 0 / 100 | **0%** | 0% - 0% |
| Codex / Cursor | `baseline` | [Simulated] | gpt-4o | 1.0.0 | 3 | 38 / 100 | **38%** | 38% - 38% |
| Codex / Cursor | `mcp` | [Simulated] | gpt-4o | 1.0.0 | 3 | 0 / 100 | **0%** | 0% - 0% |

## Task Distribution by Ecosystem

| Ecosystem | Tasks Count | Share |
|:---|:---:|:---:|
| `npm` | 69 | 69% |
| `pypi` | 21 | 21% |
| `github-actions` | 3 | 3% |
| `container` | 3 | 3% |
| `generic` | 4 | 4% |

## Methodology

1. **Task Selection**: 100 realistic prompts across NPM, PyPI, GitHub Actions, Container base images, and generic runtimes. Prompts describe requirements functionally without naming deprecated components or mentioning Ebb.
2. **Evaluation by File Outputs**: Agents execute in an isolated temp directory. Scoring reads strictly from the generated files (`package.json`, `requirements.txt`, workflow YAML, `Dockerfile`) and checks every declared dependency against Ebb's active lifecycle rules. Prose text is never scored.
3. **Repeated Runs and Variance**: Each task and mode is evaluated across multiple repetitions ($n \ge 3$). The report displays the mean deprecation rate alongside the minimum and maximum spread across runs.
4. **Tested Configurations**:
   - **Baseline**: Standard unassisted agent code generation.
   - **MCP**: Agent equipped with Ebb MCP server tools (`check`, `rules_for`, `replacement_for`).
   - **Skill**: Agent equipped with the official Ebb `check-before-add` agent skill.

## Known Limits

- **Simulated vs Real Runs**: Simulated runners provide deterministic CI verification without incurring API fees. Real runs require API tokens and execute via the manual workflow.
- **Agent Non-Determinism**: Real LLM completions exhibit variance across runs; the reported range is the observed minimum and maximum across repetitions.
- **Offline Sandbox**: Real runs must have network access for agent LLM calls while the Ebb library evaluates lifecycle data completely offline.

## Reproducibility

This benchmark can be re-run reproducibly using:
```bash
npm run eval:agents
```
