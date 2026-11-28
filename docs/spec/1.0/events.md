---
title: Lifecycle events
description: Ebb event meanings, date semantics and ordering.
layout: doc
permalink: /spec/1.0/events/
---

Each rule carries one `event`. The date, when present, is in `deadline` as a UTC calendar day. `observedAt` and `reviewedAt` are provenance dates.

### ELF-EVENT-01

A producer MUST use one of the seven events below. A supplied `deadline` MUST denote the boundary described by that event. A reader MUST preserve an absent date as unknown.

| Event | Meaning of the event | Meaning of `deadline` |
| --- | --- | --- |
| `deprecated` | The maintainer discourages the affected version, component or usage. | When deprecation takes effect, if known. |
| `end-of-support` | The stated support program ends. Separate extended or paid support can continue. | End of the stated support program, if known. |
| `end-of-life` | The affected version reaches its terminal lifecycle boundary under the stated source policy. | End of life, if known. |
| `removed` | The affected item, feature or usage is no longer provided in the stated context. | When removal takes effect, if known. |
| `scheduled-end-of-life` | The vendor announced a future end-of-life date. | The announced end-of-life day. |
| `end-of-active-support` | Routine active support ends. A subsequent phase may still receive security or other support. | The announced end of active support. |
| `end-of-extended-support` | A separately stated extended support program that outlives normal support ends. The program may be paid. | The end of the extended program, if known. |

### ELF-EVENT-02

A producer MUST supply the announced `deadline` for `scheduled-end-of-life` and `end-of-active-support`. A `scheduled-end-of-life` rule MUST carry `severity: "low"`. A reader MUST retain the stored event. Promotion to `end-of-life` is a producer's reviewed data change. A separately requested [historical projection](https://velella.sh/ebb/spec/1.0/matching/#elf-match-05) may derive a result for the specified day while preserving the stored rule. [Decision 0010](https://velella.sh/ebb/decisions/0010-scheduled-end-of-life/)

### ELF-EVENT-03

When summarizing multiple applicable records as one event, a consumer MUST use this precedence, highest first.

1. `end-of-life`
2. `removed`
3. `end-of-support`
4. `deprecated`
5. `scheduled-end-of-life`
6. `end-of-active-support`
7. `end-of-extended-support`

Within the same event, sort dated matches by earliest deadline with undated matches after dated ones. Preserve order when both the event and deadline tie. Keep each matched event available alongside the summary. An extended support record describes its own program even when a standard-support record ranks higher.

## Registry examples

The examples identify one existing rule per event.

```json
[
  {"event":"deprecated","id":"npm.package.request.deprecated","deadline":"2020-02-11"},
  {"event":"end-of-support","id":"go.runtime.end-of-support-1.25","deadline":"2026-08-19"},
  {"event":"end-of-life","id":"npm.package.node-sass.eol","deadline":"2024-07-24"},
  {"event":"removed","id":"ci-images.azure-pipelines.macos-13","deadline":"2025-12-04"},
  {"event":"scheduled-end-of-life","id":"nodejs.runtime.eol-22","deadline":"2027-04-30"},
  {"event":"end-of-active-support","id":"php.runtime.end-of-active-support-8.2","deadline":"2024-12-31"},
  {"event":"end-of-extended-support","id":"container.ubuntu.extended-support-14.04","deadline":"2029-05-31"}
]
```
