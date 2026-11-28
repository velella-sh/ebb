---
title: Lifecycle Format proposals
description: How to submit and record a decision about changes to the Ebb Lifecycle Format.
layout: doc
permalink: /spec/proposals/
---

Use a proposal when a change would alter the [Ebb Lifecycle Format](https://velella.sh/ebb/spec/1.0/) or how independent readers and producers apply one of its requirements. Examples include changing accepted wire data, adding a normative requirement, or clarifying an ambiguous matching rule in a way that changes implementations. A spelling or formatting correction can go straight to the spec text when its meaning stays the same.

Copy the [proposal template](https://velella.sh/ebb/spec/proposals/template/) to `docs/spec/proposals/NNNN-short-topic.md`. Assign the next available four-digit number and retain it through review and decision. The template reserves `0000`, so the first record uses `0001`. Numbers stay assigned to postponed and rejected proposals.

Link the affected requirement IDs and implementation or conformance evidence. Include the proposed wording, compatibility effects and comment-window dates. When a decision is recorded, keep the final decision, date and reasons in the same numbered file. Spec proposal and decision records live in this directory. Implementation decisions for Ebb's code live in `docs/decisions/`.
