---
title: Tide report
description: A monthly preview of lifecycle deadlines and recent evidence from signed Ebb data.
layout: doc
permalink: /tide-report/
---

Tide prepares a monthly digest from the signed Ebb dataset used by the site. Each deadline points to its rule and the rule's original evidence.

## What each report covers

- **Ending this month** lists announced deadlines from the first through the last UTC day of the month.
- **Ending in the next 90 days** includes additional announced deadlines after the month ends, through 90 days after the report's first UTC day.
- **Predicted ends** lists only dates the signed rules mark as estimates, together with their rule confidence. A month-precision date stays a month.
- **New and changed rules last month** compares signed snapshots when both are available. The earlier snapshot must predate the previous month and the later one must be the last snapshot dated within it. Announced deadlines that fell during the previous month appear separately.

A preview records its UTC reference day and signed data version. Empty sections stay visible and explain whether the snapshot has no matching deadlines or lacks a comparison baseline.

## Example for December 2026

The following excerpt uses [signed data 2026.11.11](https://github.com/velella-sh/ebb/releases/tag/data-v2026.11.11) as of 2026-12-01 UTC. The preview includes the full list for each window.

### Ending this month

- **2 December 2026** — [Amazon EKS 1.34 leaves standard support](https://velella.sh/ebb/rules/kubernetes-amazon-eks-1-34/). [AWS release calendar](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html)

### Ending in the next 90 days

- **31 January 2027** — [ElastiCache for Redis OSS 6 reaches end of standard support](https://velella.sh/ebb/rules/database-aws-elasticache-redis-scheduled-end-of-support-6/). [AWS engine versions](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/engine-versions.html)
- **28 February 2027** — [Kubernetes 1.35 reaches end of life](https://velella.sh/ebb/rules/kubernetes-release-end-of-life-1-35/). [Kubernetes release history](https://kubernetes.io/releases/)

### Predicted ends

This snapshot lists no estimated deadlines in the window.

### New and changed rules last month

The signed release log has no earlier baseline for November 2026. It describes the snapshot that records these dates, including [PostgreSQL 14 ending support on 12 November](https://velella.sh/ebb/rules/database-postgresql-end-of-life-14/). [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)

## Follow the data and previews

- Browse the [monthly deadlines](https://velella.sh/ebb/deadlines/) for the announced dates included in the site's signed snapshot.
- Subscribe to the [Atom data-release feed](https://velella.sh/ebb/atom.xml) for signed data updates.
- Open a completed [Tide preview run](https://github.com/velella-sh/ebb/actions/workflows/tide-report.yml) and download its month-named artifact for the Markdown and PNG. Scheduled previews run on the first Monday in UTC. The workflow also accepts a requested month when run manually.
- [Discussion setup and the first public post](https://github.com/velella-sh/ebb/issues/909) are tracked by the maintainer.

## Reproduce a preview

Build the tools with `npm ci` and `npm run build`. Download the complete signed Ebb bundle, detached signature, signed `release-log.jsonl` and its signature into one directory. Pass the month, verified data pin and artifact paths to `node dist/tools/tide-report.js`. The month fixes the UTC reference day.

```bash
node dist/tools/tide-report.js \
  --month 2026-12 --data-version 2026.11.11 \
  --sha256 09f3f558e6708b6f7ec8fd4df0494601d4c1c99eb50526f7db20591a3852f3a4 \
  --bundle ebb-data-2026.11.11.json \
  --signature ebb-data-2026.11.11.json.sigstore.json \
  --historical-verifier /path/to/ebb-0.2.0/node_modules/@velella/ebb > tide-report.md
```

For a PNG, add `--site-tools <node_modules> --card tide-card.png` with the site's pinned Mizzen and Lateen packages installed. The preview uses the site's existing SVG template, font and brand asset. When the signed log identifies both snapshots for a comparison, supply the earlier artifact with `--previous-bundle <bundle.json>` and keep its `.sigstore.json` file beside it. The signed log supplies the earlier snapshot's version and expected digest.
