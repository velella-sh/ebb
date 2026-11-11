---
title: "Agent Skills"
description: "Equip AI coding agents (Claude Code, Cursor, Antigravity, Gemini CLI) with check-before-add lifecycle verification via Ebb's official Agent Skill."
layout: doc
permalink: /skills/
---

Ebb provides an official [Agent Skill](https://skills.sh) under the `velella-sh` organization namespace (`velella-sh/ebb`).

The skill equips AI coding agents with proactive guardrails: before recommending `npm i`, `pip install`, picking language runtimes, or upgrading GitHub Actions, the agent checks Ebb to ensure no deprecated or end-of-life dependencies enter the codebase.

## Quick Install via skills.sh

Install the official Ebb skill across your agent environment using the `skills` CLI:

```bash
npx skills add velella-sh/ebb
```

This installs the skill directly from the `velella-sh/ebb` repository into your local or global agent configuration (`.claude/skills/`, `.cursor/skills/`, or `.gemini/skills/`).

## Installation by Agent

### Claude Code

Install via skills CLI or place the skill in your project's `.claude/skills/` directory:

```bash
# Add using skills.sh CLI
npx skills add velella-sh/ebb --target claude

# Or install from local repo clone
mkdir -p .claude/skills
cp -r node_modules/@velella/ebb/skills/ebb .claude/skills/
```

### Cursor & Codex

In Cursor and Codex, skills are automatically discovered when placed in `skills/` or referenced in system rules:

```bash
npx skills add velella-sh/ebb --target cursor
```

### Antigravity & Gemini CLI

In Antigravity and Gemini CLI:

```bash
npx skills add velella-sh/ebb --target gemini
```

## How the Skill Works

The skill guides the agent through three strict verification steps:

1. **Detect Project Runtimes**: Discovers `.nvmrc`, `Dockerfile`, `package.json` engines, and `.python-version` to ensure code matches actively supported runtime versions.
2. **Check New Packages Before Install**: Converts packages to standard Package URLs (PURLs) like `pkg:npm/request@2.88.2` and queries Ebb. If deprecated or EOL, the agent halts and proposes a modern replacement (e.g. `undici` or `axios`).
3. **Verify GitHub Actions**: Flags retired Node 12/16 runner actions and out-of-support runner operating systems before committing workflow YAML files.

## Example Agent Verdict

When Ebb detects an issue, the agent outputs a structured finding:

```text
- Component: pkg:npm/request@2.88.2
- Status: deprecated
- Deadline / EOL Date: 2020-02-25
- Recommended Replacement: undici, axios, or native fetch
- Evidence: https://www.npmjs.com/package/request
```
