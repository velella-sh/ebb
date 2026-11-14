---
title: Ebb documentation
description: Ebb is an open dataset of software lifecycle rules, with a small TypeScript library for reading it.
layout: home
hero:
  eyebrow: v0.2.0 · end-of-life data
  title: Nothing ships forever. Everything ebbs.
  lead: Ebb is an open dataset of software lifecycle rules. It records what is deprecated, unsupported, end-of-life, or removed, since when, and what to move to, each with its evidence.
actions:
  - label: Quickstart (5 min)
    url: quickstart/
    primary: true
  - label: Try the CLI
    url: cli/
  - label: Data & Trust
    url: data/
sections:
  - title: Getting Started & Guides
    url: quickstart/
    description: Add to the registry, run the zero-dependency CLI, draft rules from sources, and consume signed data.
    icon: "M5 4h10l4 4v12H5zM14 4v5h5M9 13h6M9 17h6"
    links:
      - title: 5-Minute Quickstart
        url: quickstart/
        meta: guide
      - title: Command Line (CLI)
        url: cli/
        meta: guide
      - title: Writing a rule
        url: rules/
        meta: guide
      - title: Importers
        url: importers/
        meta: guide
      - title: Data bundles and trust
        url: data/
        meta: guide
      - title: Static JSON API
        url: static-api/
        meta: guide
  - title: Multi-Runtime Support
    url: browser/
    description: Run anywhere with zero dependencies — browsers, edge workers, Deno, Bun, and Node.
    icon: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"
    links:
      - title: Browser
        url: browser/
        meta: runtime
      - title: Edge & Workers
        url: edge/
        meta: runtime
      - title: Deno & JSR
        url: deno/
        meta: runtime
      - title: Bun
        url: bun/
        meta: runtime
  - title: Coding Agents
    url: skills/
    description: Give Claude Code, Cursor, Codex, and other AI agents authoritative lifecycle knowledge.
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
    links:
      - title: Agent Skill
        url: skills/
        meta: agent
      - title: MCP Server
        url: mcp/
        meta: agent
  - title: Reference & Types
    url: result-model/
    description: Structured schemas, batch inspection, native VERS comparison, and TypeScript definitions.
    icon: "M4 5h7a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4zM20 5h-6a3 3 0 0 0-3 3v11a2 2 0 0 1 2-2h7z"
    links:
      - title: Result model
        url: result-model/
        meta: reference
      - title: Rules and replacements
        url: rules-for/
        meta: reference
      - title: Batch checking
        url: check-all/
        meta: reference
      - title: VERS version ranges
        url: vers/
        meta: reference
      - title: API stability
        url: api-stability/
        meta: reference
      - title: TypeScript types
        url: types/
        meta: reference
      - title: Migrating to 0.2.0
        url: migration-0.2/
        meta: reference
  - title: Decisions & Architecture
    url: decisions/0004-registry-v2/
    description: The reasoning behind the registry format, importers, scheduled end-of-life, and data bundles.
    icon: "M4 7h9M17 7h3M4 17h3M11 17h9M13 4v6M7 14v6"
    links:
      - title: Registry v2
        url: decisions/0004-registry-v2/
        meta: decision
      - title: Lifecycle importers
        url: decisions/0005-lifecycle-importers/
        meta: decision
      - title: Data bundle
        url: decisions/0006-data-bundle/
        meta: decision
      - title: Scheduled end-of-life
        url: decisions/0010-scheduled-end-of-life/
        meta: decision
      - title: Incomplete purls
        url: decisions/0011-check-incomplete-purls/
        meta: decision
---
