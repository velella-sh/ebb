---
title: Cutoff evaluation methodology
description: Dated lifecycle questions, signed answer evidence and deterministic fixture replay.
layout: doc
permalink: /cutoff-report/
---

The cutoff evaluation asks whether a developer should choose particular runtime, package, CI action and database versions on a fixed date. The question set contains 150 questions across 20 ecosystems. Its answer key uses Ebb's [signed data release 2026.11.11](https://github.com/velella-sh/ebb/releases/tag/data-v2026.11.11), with 11 November 2026 UTC as the reference date.

The [questions and answer key](https://github.com/velella-sh/ebb/blob/main/evals/cutoff/questions.json) list the exact choices, matching Ebb rule IDs and original evidence URLs. The [corpus documentation](https://github.com/velella-sh/ebb/blob/main/evals/cutoff/README.md) records the ecosystem spread and how to verify every answer against the released bundle.

## How an answer is scored

Both prompt arms use the same question, choices, date and response instructions. The with-Ebb arm adds the applicable recorded events, dates and sources. The scoring program deterministically matches the exact response to one named option or records an abstention.

A choice marked **end-of-life** has matching ended, unsupported or removed evidence in the question's scope. A **deprecated** choice has matching deprecation evidence. A **fine** choice has a recorded future support-ending date at the reference day. Exact options or canonical package URL/version strings can be scored. Multiple, unfamiliar or unparseable choices are **unclear**. An explicit abstention is separately identified within that outcome.

For example, the question about PostgreSQL 13.0 and 14.0 uses the upstream support windows. On the snapshot date, 13.0 is classified as end-of-life and 14.0 has a recorded support-ending date on 12 November 2026. Consult the [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/) before making a present-day decision.

## Recorded evidence

The repository currently provides the question set, signed answer evidence and synthetic test responses. The fixture answers are authored samples of the scorer's input format. The evaluation concerns selection of the stated versions. Agent behaviour during migrations is outside its scope. The live model runs and publication are tracked in [#698](https://github.com/velella-sh/ebb/issues/698) and [#807](https://github.com/velella-sh/ebb/issues/807).

Run these commands from a clone to replay the labelled fixtures or inspect the two prompt arms.

```bash
npm ci
npm run build
node dist/evals/cutoff/run.js
node dist/evals/cutoff/run.js --prompts
```
