---
title: Lifecycle Labels
description: Authoritative vocabulary and states for software lifecycle rules.
layout: doc
permalink: /labels/
---

# GitHub Issue Labels

Ebb uses structured labels to categorize and route work efficiently for human maintainers and autonomous agents.

## Types

- `type:epic`: Groups the tasks of one major roadmap epic.
- `type:task`: One small change, implemented in exactly one pull request.

## Priority

- `priority:P0`: Highest priority, must be addressed immediately for the milestone.
- `priority:P1`: High priority for the current milestone.
- `priority:P2`: Normal priority backlog work.

## Lanes

- `lane:free-agent`: Self-contained task suitable for any contributor or autonomous agent without specialized domain context.
- `lane:strong-agent`: Requires advanced reasoning, architectural consistency, or maintainer review.
- `lane:maintainer`: Actions restricted to core maintainers (e.g. credential provisioning, upstream publishing).

## Sizes

- `size:XS`: Very small change (e.g. documentation typo, single rule correction).
- `size:S`: Small change taking a few hours.
- `size:M`: Medium change affecting multiple modules or tests.

## Areas

- `area:core`: Core evaluation engine (`src/check.ts`, `src/check-all.ts`, `src/rules-for.ts`).
- `area:standards`: Package URL (purl) and VERS specification conformance.
- `area:data`: Rule registries, schemas, and static data bundles (`registry/`, `data/`).
- `area:agent`: Agent tools, Model Context Protocol (MCP) server, and skills.
- `area:release`: Packaging, size budgets, CI workflows, and publishing.
- `area:docs`: Documentation, guides, and specifications (`docs/`).
- `area:integration`: External integrations and consumer contracts (e.g. Offing).
