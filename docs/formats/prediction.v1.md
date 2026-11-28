---
title: Prediction format v1
permalink: /formats/prediction.v1/
description: The machine-readable format for lifecycle estimates and their evidence.
---

A prediction is a planning estimate for a specific Package URL and release-line VERS range. Show the word **predicted**, the range, and the confidence beside every estimate. Prefer announced dates as soon as they exist. Predictions never change status, recommendations, exit codes, or the authoritative [result model](../result-model.md).

| Field | Meaning |
| --- | --- |
| `purl`, `line`, `lineVers` | Canonical product identity, vendor release-line name and exclusive or inclusive VERS bounds. |
| `predictedEnd` | Point estimate `date` and inclusive `low` and `high`, all UTC calendar days. `precision` is the model's display precision. Display `month` as a month and year. |
| `confidence` | Empirical label from the per-product and per-method [backtest](../predict.md). |
| `method` | `policy` uses a published support policy, with release history or a tentative schedule. `cadence` uses observed release lifetimes. |
| `evidence` | HTTPS evidence links with access dates. `history` and `schedule` identify the line and its release date or release month. `history.end` is the observed end where known, at source precision. |
| `modelVersion` | Version of the estimation method. |
| `dataVersion` | Date of the immutable input snapshot, in `YYYY.MM.DD` format. |

## Policy example

```json
{
  "purl": "pkg:generic/golang",
  "line": "1.26",
  "lineVers": "vers:golang/>=1.26.0|<1.27.0",
  "predictedEnd": { "date": "2027-02-15", "low": "2027-01-25", "high": "2027-03-07", "precision": "month" },
  "confidence": "medium",
  "method": "policy",
  "evidence": [
    { "kind": "policy", "url": "https://go.dev/doc/devel/release", "accessedAt": "2026-11-28" },
    { "kind": "schedule", "url": "https://github.com/golang/go/blob/master/doc/next/1-intro.md", "accessedAt": "2026-11-28", "line": "1.28", "firstReleased": "2027-02" }
  ],
  "modelVersion": "1.0.0",
  "dataVersion": "2026.11.28"
}
```

## Cadence example

```json
{
  "purl": "pkg:generic/ruby",
  "line": "3.4",
  "lineVers": "vers:gem/>=3.4.0|<3.5.0",
  "predictedEnd": { "date": "2028-04-03", "low": "2028-03-26", "high": "2028-04-23", "precision": "month" },
  "confidence": "low",
  "method": "cadence",
  "evidence": [
    { "kind": "history", "url": "https://www.ruby-lang.org/en/downloads/branches/", "accessedAt": "2026-11-15", "line": "3.0", "firstReleased": "2020-12-25", "end": "2024-04-23" },
    { "kind": "history", "url": "https://www.ruby-lang.org/en/downloads/branches/", "accessedAt": "2026-11-15", "line": "3.1", "firstReleased": "2021-12-25", "end": "2025-03-26" },
    { "kind": "history", "url": "https://www.ruby-lang.org/en/downloads/branches/", "accessedAt": "2026-11-15", "line": "3.2", "firstReleased": "2022-12-25", "end": "2026-04-01" }
  ],
  "modelVersion": "1.0.0",
  "dataVersion": "2026.11.28"
}
```

## Precedence and matching

Match the canonical PURL and compare the requested version with `lineVers`. Return `null` for an unknown version or a version with an authoritative end rule. A dated rule covering a whole release line removes that line from the predictions. A rule covering only some versions suppresses a prediction for those versions when queried individually.

## Published table

`predictions.json` validates against the same [v1 schema](https://velella.sh/ebb/api/v1/schemas/prediction.v1.schema.json). It carries `schemaVersion: "ebb.prediction.v1"`, `dataVersion`, a SHA-256 fingerprint of its generation inputs, and predictions ordered by PURL and line. The [static API index](../static-api.md) supplies the SHA-256 of the actual file bytes.
