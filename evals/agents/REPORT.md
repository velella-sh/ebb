# Ebb Agent Evaluations Report

> Benchmark evaluating AI coding agents on dependency and runtime selection tasks with and without Ebb lifecycle checks.

## Headline Results

- **Total benchmark tasks:** 100
- **Deprecated/EOL picks without Ebb (Baseline):** 38%
- **Deprecated/EOL picks with Ebb (MCP / Skill):** 0%
- **Deprecation rate reduction:** **-38 percentage points** (100% reduction in deprecated picks)

## Benchmark Matrix

| Agent | Mode | Total Tasks | Deprecated / EOL | Supported | Deprecation Rate |
|:---|:---|:---:|:---:|:---:|:---:|
| Claude Code | `baseline` | 100 | 38 | 62 | **38%** |
| Claude Code | `mcp` | 100 | 0 | 100 | **0%** |
| Claude Code | `skill` | 100 | 0 | 100 | **0%** |
| Codex / Cursor | `baseline` | 100 | 38 | 62 | **38%** |
| Codex / Cursor | `mcp` | 100 | 0 | 100 | **0%** |

## Task Distribution by Ecosystem

| Ecosystem | Tasks Count | Share |
|:---|:---:|:---:|
| `npm` | 69 | 69% |
| `pypi` | 21 | 21% |
| `github-actions` | 3 | 3% |
| `container` | 3 | 3% |
| `generic` | 4 | 4% |

## Methodology

1. **Task Selection**: 100 realistic prompts across NPM, PyPI, GitHub Actions, Container base images, Databases, and generic runtimes where developers ask an assistant to recommend or configure a dependency.
2. **Baseline Evaluation**: Agents pick components based on standard pre-trained preferences (e.g. `request`, `node-sass`, `node@14`, `actions/checkout@v1`). Each pick is checked against the Ebb registry.
3. **Ebb-Assisted Evaluation**: The agent operates with the Ebb MCP server (`check`, `replacement_for`) or the `check-before-add` agent skill. Deprecations are caught and replaced with supported alternatives.
4. **Score Definition**: The primary score is **Deprecation Rate (%)** = `(deprecated_or_eol_picks / total_tasks) * 100`.

## Reproducibility

This benchmark can be re-run reproducibly using:
```bash
npm run eval:agents
```