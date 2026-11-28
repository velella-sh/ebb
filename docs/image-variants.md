---
title: Official image base distributions
description: Resolve a Docker Official Images tag to its base distribution and check that release in Ebb.
layout: doc
permalink: /image-variants/
---

For `FROM node:22`, the bundled snapshot maps the tag to Debian 12 (Bookworm). The Debian project schedules the end of Bookworm LTS for June 30, 2028. The end date applies to the [architectures covered by Debian LTS](https://www.debian.org/releases/bookworm/).

```js
import { check } from "@velella/ebb";
import { baseImageOf } from "@velella/ebb/image-variants";
const base = baseImageOf("pkg:docker/library/node", "22"); if (base.status === "known") console.log(check(base.purl, base.version).matches[0]?.date);
```

The Node.js package reads the tables offline, on first use. Pass an unqualified `pkg:docker/library/<name>` and the literal tag, such as `22-bookworm` or `3.12-slim-bookworm`. For a verified manifest use its full tag and digest, such as `22@sha256:7c400d78797d8cbe3f6bb21d2227b86af4cd24b0014cc9f62ff989cc16de988e`. Unresolved tags and digests return `{ status: "unknown" }`. A tag whose architectures or shared definitions point to different OS releases also returns `unknown`.

Use `codename("ubuntu", "noble")` for Ubuntu 24.04 and `codenamesOf("nodejs-lts")` for all recorded Node.js LTS names. The lookup families are `debian`, `ubuntu`, and `nodejs-lts`.

## Coverage and refresh

The initial table covers resolved tags for Alpine, Debian, Drupal, Go, MariaDB, Node.js, PostgreSQL, Python, Ruby, and Ubuntu. Its [pinned Official Images commit](https://github.com/docker-library/official-images/tree/c788a3606c4d0231711ae26d9e6de137e60d1002/library) identifies the library files used to build it.

Caddy and Traefik list a generic Alpine directory with no release line, and their Windows variants fall outside the table's supported families. ClickHouse, Couchbase, CouchDB, MySQL, and ZooKeeper list application version directories. phpMyAdmin lists build profiles, and Redis lists family names without release lines. Tags lacking release-level evidence stay unknown.

The [weekly importer](/importers/) checks the official library file hashes every Tuesday and opens a pull request with a table draft when they change. The source has a seven-day freshness target.

The static API publishes [image variants](https://velella.sh/ebb/api/v1/image-variants.json) and [release codenames](https://velella.sh/ebb/api/v1/codenames.json). The [API index](https://velella.sh/ebb/api/v1/index.json) lists their SHA-256 hashes. See the [table formats](/formats/image-variants-v1/) for the source and lookup semantics.
