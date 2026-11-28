---
title: Ebb integration status
description: Published integrations, checked compatibility and the status of upstream proposals.
layout: doc
permalink: /integrations/
---

## Published integrations

Ebb publishes a Renovate preset and custom datasource. The Node.js datasource returned ten release lines on 28 November 2026. This row counts as a published Ebb integration. [Preset and setup](https://velella.sh/ebb/renovate/) · [Live Node.js feed](https://velella.sh/ebb/api/v1/renovate/generic/nodejs.json)

## Compatibility evidence

Ebb documents the CycloneDX properties it writes and the import of an enriched CycloneDX 1.6 SBOM into Dependency-Track 4.13.6. These checks cover the documented artifact and importer version. [SBOM enrichment and import evidence](https://velella.sh/ebb/sbom/#verified-dependency-track-import)

## Upstream proposals

Status was checked on 28 November 2026 UTC against the Ebb tasks and linked public upstream sources. A dash marks a field awaiting a sent Ebb proposal. The proposal reaction count starts with the published upstream request.

| Target | Ebb task | Status | Date sent | Proposal reactions | Public upstream context |
| --- | --- | --- | --- | --- | --- |
| SchemaStore | [Declaration schema catalog submission](https://github.com/velella-sh/ebb/issues/965) | Not sent | — | — | [Public catalog](https://www.schemastore.org/api/json/catalog.json) |
| purl-spec | [Share the identifier audit](https://github.com/velella-sh/ebb/issues/935) | Not sent | — | — | [GitHub Actions PURL proposal](https://github.com/package-url/purl-spec/issues/698) |
| CycloneDX and Ecma TC54 | [Share the lifecycle mapping](https://github.com/velella-sh/ebb/issues/966) | Not sent | — | — | [Property taxonomy](https://github.com/CycloneDX/cyclonedx-property-taxonomy) · [Ecma TC54](https://ecma-international.org/technical-committees/tc54/) |
| OpenEoX | [Share the experimental mapping](https://github.com/velella-sh/ebb/issues/948) | Not sent | — | — | [OASIS OpenEoX committee](https://www.oasis-open.org/tc-openeox/) |
| Dependency-Track | [Offer CLE and conformance examples](https://github.com/velella-sh/ebb/issues/953) | Not sent | — | — | [Component lifecycle issue](https://github.com/DependencyTrack/dependency-track/issues/3108) |
| Renovate | [Offer maintainer declarations](https://github.com/velella-sh/ebb/issues/981) | Not sent | — | — | [Package enrichment proposal](https://github.com/renovatebot/renovate/issues/40048) |

The linked purl-spec, Dependency-Track, and Renovate issues were open with four, 32, and 15 reactions respectively at the check date. Those counts belong to the existing upstream topics. When a maintainer sends an Ebb proposal, record its public URL, sent date, current state, and reaction count in this table. Add a shipped integration under Published integrations once its artifact is available.
