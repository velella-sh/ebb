---
title: Ebb documentation
description: Ebb is an open dataset of software lifecycle rules, with a small TypeScript library for reading it.
layout: home
hero:
  eyebrow: v0.1.1 · end-of-life data
  title: Nothing ships forever. Everything ebbs.
  lead: Ebb is an open dataset of software lifecycle rules. It records what is deprecated, unsupported, end-of-life, or removed, since when, and what to move to, each with its evidence.
actions:
  - label: Write a rule
    url: rules/
    primary: true
  - label: Data and trust
    url: data/
sections:
  - title: Guides
    url: rules/
    description: Add to the registry, draft rules from sources, and consume signed data.
    icon: "M5 4h10l4 4v12H5zM14 4v5h5M9 13h6M9 17h6"
    links:
      - title: Writing a rule
        url: rules/
        meta: guide
      - title: Importers
        url: importers/
        meta: guide
      - title: Data bundles and trust
        url: data/
        meta: guide
  - title: Reference
    url: result-model/
    description: What the lookup APIs return.
    icon: "M4 5h7a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4zM20 5h-6a3 3 0 0 0-3 3v11a2 2 0 0 1 2-2h7z"
    links:
      - title: Result model
        url: result-model/
        meta: reference
      - title: Batch checking
        url: check-all/
        meta: reference
  - title: Decisions
    url: decisions/0004-registry-v2/
    description: The reasoning behind the registry format, importers, and data bundles.
    icon: "M4 7h9M17 7h3M4 17h3M11 17h9M13 4v6M7 14v6"
    links:
      - title: Registry v2
        url: decisions/0004-registry-v2/
        meta: decision
      - title: Data bundle
        url: decisions/0006-data-bundle/
        meta: decision
---
