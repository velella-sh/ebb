---
title: "Runtime release-line coverage"
description: "Which language runtimes Ebb tracks end-to-end, what complete means, and the official schedule each runtime uses."
layout: doc
permalink: /coverage/
---

Ebb aims to know every release line for the runtimes below: ended lines and scheduled end dates, taken only from each project's own support schedule.

## What "complete" means

A runtime is **complete** when both are true:

1. **Every release line first released since 2018** has a registry rule that covers its end (end-of-life, end-of-support, or an equivalent catch-all that matches that line).
2. **Every still-supported line with an official end date** has a `scheduled-end-of-life` (or scheduled end-of-support) rule for that date.

Dates keep the precision the official source publishes. Month-only announcements stay month-precision in summaries; the checker and expected files record that precision. Ebb does not invent a day-of-month, and it does not copy dates from third-party aggregators.

Runtimes with **no published support schedule** are listed only to document that limit. They are not treated as incomplete for lacking dated rules.

## Scope

| Runtime | Official schedule | In scope |
| --- | --- | --- |
| Node.js | [Node.js Release Working Group schedule](https://github.com/nodejs/Release/blob/main/schedule.json) | Yes |
| Python | [Status of Python versions](https://devguide.python.org/versions/) ([machine-readable cycle](https://peps.python.org/api/release-cycle.json)) | Yes |
| Go | [Go release history and support policy](https://go.dev/doc/devel/release) | Yes |
| Java | [Eclipse Temurin support](https://adoptium.net/support/) (OpenJDK / Temurin availability; vendor named per rule) | Yes |
| Ruby | [Ruby maintenance branches](https://www.ruby-lang.org/en/downloads/branches/) | Yes |
| PHP | [PHP supported versions](https://www.php.net/supported-versions.php) ([unsupported branches](https://www.php.net/eol.php)) | Yes |
| .NET | [.NET and .NET Core support policy](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core) | Yes |
| Rust | [Rust Book — maintenance time](https://doc.rust-lang.org/book/appendix-07-nightly-rust.html#maintenance-time) ([security policy](https://www.rust-lang.org/policies/security)) | Yes |
| Deno | [Deno stability and releases (LTS)](https://docs.deno.com/runtime/fundamentals/stability_and_releases/) | Yes (dated LTS lines only) |
| Bun | No official dated support schedule | Limits only — no dated rules required |

## Coverage status

The table below is filled at documentation build time by `tools/coverage/runtimes.ts` from the reviewed expected release lines under `tools/coverage/expected/` and the current registry. It is not edited by hand.

<!-- runtime-coverage:begin -->

| Runtime | Status | Missing lines | Missing scheduled |
| --- | --- | --- | --- |
| bun | limit | — | — |
| deno | complete | — | — |
| dotnet | complete | — | — |
| go | complete | — | — |
| java | complete | — | — |
| nodejs | complete | — | — |
| php | complete | — | — |
| python | complete | — | — |
| ruby | complete | — | — |
| rust | complete | — | — |

<!-- runtime-coverage:end -->

## Limits

- **Bun:** No official dated support or LTS schedule is published. Existing historical Bun entries in `registry/deno.json` are not expanded; new dated Bun rules are not added until Bun publishes a schedule.
- **Deno:** Coverage tracks the official LTS maintenance table on the Deno stability page. Undated stable-channel minors without an LTS row are not given invented end dates.
- **Ruby 3.4 / 4.0 / 4.1:** The maintenance branches page lists EOL as TBD; those lines stay policy-only until a date is published.
- **Java LTS (Temurin):** “At least …” availability floors are not treated as end dates, so no scheduled rule is invented from them.

## Checker

```bash
npm run build --silent
node dist/tools/coverage/runtimes.js
```

The checker reads only local expected JSON and `registry/`. It does not fetch the network. Exit code `1` means at least one in-scope runtime still has a gap.
