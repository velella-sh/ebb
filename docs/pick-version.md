---
title: "Which version should I install"
description: "Ask Ebb which release lines it knows for a runtime or package, and which line it would take."
layout: doc
permalink: /pick-version/
---

# Which version should I install

`supportedVersions` answers a different question from `check`. `check` says whether one version has a lifecycle rule. `supportedVersions` lists the release lines those rules name and recommends the line whose known end date is furthest ahead, when that date is more than 180 days away.

`complete` is true only when a rule covers every version, or the numbered lines from the oldest known line through the newest have no gap. A note that Ebb has no rule past the last line does not by itself make the answer incomplete. Ebb does not call a line supported: the reason states the end date it knows.

The reference day below is 15 November 2026. Pass `--as-of` or `asOf` so the answer does not move when the clock does.

## Library

```ts
import { supportedVersions } from "@velella/ebb";

const node = supportedVersions("node", { asOf: "2026-11-15" });
// node.recommendation.lineId === "26.x"
// node.complete === true
// node.lines includes 22.x, ending 2027-04-30

const python = supportedVersions("python", { asOf: "2026-11-15" });
// python.recommendation.lineId === "3.15"

const request = supportedVersions("pkg:npm/request", { asOf: "2026-11-15" });
// request.lines[0].id === "*"
// request.recommendation === null
// every known line has already ended
```

The same call works from the browser entry. `asOf("2026-11-15").supportedVersions("node")` uses that day and does not read the clock.

## Command line

```bash
npx @velella/ebb versions node --as-of 2026-11-15
npx @velella/ebb versions python --as-of 2026-11-15 --format markdown
npx @velella/ebb versions pkg:npm/request --as-of 2026-11-15 --json
```

Text output marks the chosen line with the word `recommended`. An unknown component prints an empty line list and exits 0.

## MCP

Call `pick_version` before choosing a runtime or a major version. Pass `purl` and, when the answer must be repeatable, `as_of`.

```json
{ "purl": "node", "as_of": "2026-11-15" }
```

The tool returns the lines, the recommendation, the completeness flag, the reason, and a short text summary. It recommends a line only when the library does.

## Static API

Each component file includes a `versions` object built with the same function: `asOf`, `complete`, `reason`, `recommendation`, `notes`, and `lines`. It is a summary of the rules in that file, not a file per version number.
