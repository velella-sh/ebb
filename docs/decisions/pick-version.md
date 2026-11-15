---
title: "Which version should I install"
description: "supportedVersions names the release lines a component's rules already cover and recommends one only when its end date is far enough ahead."
layout: doc
permalink: /decisions/pick-version/
---

Status: accepted

## Problem

`check` answers "is this version over?". Someone choosing a runtime or a major version asks a different question: which line should I take? The registry already stores that knowledge as VERS ranges on lifecycle rules. It does not store a vendor's "latest" or "LTS" label, and it does not store lines that have no rule.

## Decision

`supportedVersions(purlOrName, options?)` reads the active rules for one component and returns the release lines those rules name.

1. **A release line is one VERS step.** `vers:semver/>=20.0.0|<21.0.0` is `20.x`. `vers:pypi/>=3.11|<3.12` is `3.11`. `vers:*` is one line, `*`, covering every version. Ordering uses the VERS scheme for that range. The label is taken from a bound the scheme has already accepted.
2. **Open ranges, version lists, and spans of several lines are not lines.** A rule such as `<18.0.0` is reported in `notes`. It is not expanded into `0.x` … `17.x`, because the rule does not name those lines.
3. **Symbol rules are ignored.** A deprecated API inside a runtime is not a release line of that runtime.
4. **The most serious event wins** when several rules name the same line. Precedence is the same order `check` uses. A `scheduled-end-of-life` rule whose deadline is on or before the reference day is reported as `end-of-life`.
5. **Status is `ended`, `ending`, or `no-known-end`.** A deadline on or before the reference day is `ended`. A later deadline is `ending`. A scheduled rule with no deadline is `no-known-end`.
6. **The recommendation is the ending line with the latest end date, and only when that date is more than 180 days ahead.** If every dated line ends sooner, or no line has a date, the recommendation is null and `reason` says why. The sentence does not say the line is supported. It says which end date Ebb knows.
7. **`complete` is true only when a `*` rule covers every version, or the numbered lines from the oldest known line through the newest have no gap.** A missing `2.x` between `1.x` and `3.x` makes `complete` false and adds a note. Versions newer than the last rule get a note too, and that note alone does not make `complete` false: Ebb is not claiming those versions exist.
8. **An unknown component is an empty answer.** `lines` is empty, `complete` is false, and `recommendation` is null. An unknown line is never labelled supported.
9. **`asOf` classifies deadlines and hides rules observed after that day.** When `asOf` is passed, the system clock is not read. When it is omitted, the UTC calendar day is read once. `asOf(date).supportedVersions(...)` uses that client's day.

## What this cannot know

- Which line a vendor currently calls LTS, current, or latest.
- A release line that has no rule, including lines inside an open range.
- That a recommended line is a good choice for a project. The reason is only the latest known end date past the 180-day horizon.
- Versions newer than every rule. The note says Ebb has no rule for them.

## Alternatives rejected

- **Parsing version numbers with a second comparator.** Line order uses the VERS scheme. A hand-written semver compare would drift from `check`.
- **Recommending the newest line even when it ends next month.** A line that ends within 180 days is not a recommendation.
- **Treating a missing rule as "supported".** Empty and incomplete answers stay explicit.
