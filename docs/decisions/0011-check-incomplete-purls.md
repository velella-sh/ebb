---
title: "0011 — `check` rejects incomplete purls; product names are the friendly entry"
description: "parsePurl / normalizePurl apply strict per-type rules (for example Maven and GitHub require a namespace)."
layout: doc
permalink: /decisions/0011-check-incomplete-purls/
---

Status: accepted

## Problem

`parsePurl` / `normalizePurl` apply strict per-type rules (for example Maven and GitHub require a namespace). A user typing into `check` may paste a partial `pkg:…` string that fails those rules. That feels unfriendly next to a check entry point that also accepts a bare product name. The question is whether `check` should keep the shared purl grammar, soften type rules only for itself, or rely on another path for casual input.

## Options

1. **Reject with today's clear purl errors.** Any input that starts with `pkg:` goes through `normalizePurl` / `parsePurl`. Incomplete or type-invalid purls throw `PurlError` with the same messages as elsewhere.
2. **Accept product names (#42).** Inputs that do not start with `pkg:` resolve through the product catalog and alias table. That is already shipped.
3. **Soften per-type checks only inside `check`.** Allow strings such as `pkg:maven/commons-lang3` (no group id) or other type-incomplete forms when calling `check`, while `parsePurl` stays strict.
4. **Something else.** For example, when a `pkg:` string fails type rules, fall back to treating a path segment as a product name.

## Decision

**Keep rejecting incomplete purls with the shared parser's clear `PurlError`s (option 1).** The friendly entry for people who are not writing a full Package URL is a **product name** (option 2 / #42), not a second, looser purl grammar inside `check`.

- An argument that starts with `pkg:` is a Package URL. It must survive the same type rules as every other call site.
- An argument that does not start with `pkg:` is a product name. Unknown or ambiguous names throw `CheckError`; a clear match maps to its purl.
- Do not soften per-type checks only inside `check`, and do not fall back from a failed purl parse to a product-name guess.

No code change follows from this record: `check` already behaves this way. This issue closes as "keep rejecting incomplete purls."

## Why (with #42 and #45)

- **#42 already covers the friendly path.** `check("node", "18.0.0")` works without inventing invalid Package URLs. Softening Maven-without-namespace (and similar) would solve a different problem than "I do not want to type a purl."
- **One validation path.** Property tests (#45) and callers can rely on `check` throwing the typed `PurlError` for bad `pkg:` input, the same as `parsePurl`. A check-only soften would fork the grammar and make "never fails in an unexpected way" harder to state.
- **Incomplete type forms are not almost-right.** `pkg:maven/commons-lang3` without a group id is not a known identity in the registry index; accepting it would invite wrong or empty matches without a clear error.

## Alternatives rejected

- **Soften per-type checks only inside `check`.** Two grammars for one identifier, silent divergence from `parsePurl` / `normalizePurl`, and weaker guarantees for #45.
- **Fall back from a failed `pkg:` parse to a product name.** A string that looks like a purl would sometimes become a name lookup, which hides the real parse error and can pick the wrong package when a path segment happens to match an alias.

## Consequences

- Callers that want a casual string use a product name; callers that pass `pkg:…` must pass a type-complete purl.
- Docs and examples for `check` should keep showing both shapes, and should not suggest partial type-incomplete purls.
- A future change that softens type rules would need a new decision; it is not an incremental tweak to `check` alone.
