---
title: Image variant and release codename formats v1
description: Table formats for tracing Docker Official Images tags to base distribution releases.
layout: doc
permalink: /formats/image-variants-v1/
---

An image variant table is a snapshot of Docker Official Images library definitions. Use a row's `baseOs.purl` and `baseOs.version` with Ebb's lifecycle checker to look up the base distribution. The release codename table relates upstream codenames to release lines. Lifecycle events and dates live in the rules.

## Image variants

An `ebb.image-variants.v1` document contains a `rows` array. The published table also includes a `snapshot` with the upstream commit, observation day in UTC, and SHA-256 hash of each in-scope library file. A missing file has a null hash. Each row identifies a unique pair of `imagePurl` and `tag`. The image PURL uses `pkg:docker/library/<name>` without a tag, version or digest. The tag preserves the exact spelling in the [Docker Official Images library file format](https://github.com/docker-library/official-images/blob/c788a3606c4d0231711ae26d9e6de137e60d1002/README.md#library-definition-files).

- `sharedTags` records other `SharedTags` aliases attached to the contributing library stanzas. The same alias can be declared across builds with different platforms and even different base distributions. Resolve a reference by looking up its exact `tag` row. The presence of an alias in `sharedTags` alone does not establish its base distribution.
- `architectures` records the architectures of the contributing stanzas. Use the per-architecture `Directory` override when present. When `Architectures` is omitted, the library format defaults to `amd64`.
- `baseOs` records `family`, `version`, `codename`, and `purl`. The importer recognizes Debian and Ubuntu codenames with optional `slim-` or `-slim` variants. It obtains an Alpine release line from exact directory names such as `alpine3.23` and sets its codename to `null`. The Debian, Ubuntu, and Alpine base images identify their release in the artifact directory or Git ref declared by the library file.
- `source` records the Official Images `repository`, the full Git `commit` used to read the library definition, and the `path` such as `library/node`. This commit identifies the snapshot defining the tag. Each library stanza may separately name the source repository and commit used to build the image.

Every contributing declaration for a tag must identify the same base distribution line to emit a row. Unresolved, unsupported or conflicting directories make an exact tag lookup return `unknown`. Declarations for Windows architectures remain unresolved by this importer. The optional `digests` array records reviewed evidence for exact `tag@sha256:…` lookups. Each entry pairs a digest with a pinned Docker Official Images Repo Info report showing the base distribution across its runnable platforms. Library file metadata establishes the tag mapping. Repo Info establishes the independent digest mapping. References without an exact valid key return `unknown`.

### Examples

These three entries use the same pinned upstream snapshot. The bare tag `node:22` comes from `22/bookworm`, `python:3.12-slim-bookworm` comes from `3.12/slim-bookworm`, and `postgres:17-alpine3.23` comes from `17/alpine3.23`. The example is a selection from the importer output.

```json
{
  "schemaVersion": "ebb.image-variants.v1",
  "rows": [
    {
      "imagePurl": "pkg:docker/library/node",
      "tag": "22",
      "sharedTags": [],
      "architectures": ["amd64", "arm32v7", "arm64v8", "ppc64le"],
      "baseOs": {"family": "debian", "version": "12", "codename": "bookworm", "purl": "pkg:generic/debian"},
      "source": {
        "repository": "https://github.com/docker-library/official-images",
        "commit": "c788a3606c4d0231711ae26d9e6de137e60d1002",
        "path": "library/node"
      }
    },
    {
      "imagePurl": "pkg:docker/library/python",
      "tag": "3.12-slim-bookworm",
      "sharedTags": [],
      "architectures": ["amd64", "arm32v7", "arm64v8", "i386", "ppc64le"],
      "baseOs": {"family": "debian", "version": "12", "codename": "bookworm", "purl": "pkg:generic/debian"},
      "source": {
        "repository": "https://github.com/docker-library/official-images",
        "commit": "c788a3606c4d0231711ae26d9e6de137e60d1002",
        "path": "library/python"
      }
    },
    {
      "imagePurl": "pkg:docker/library/postgres",
      "tag": "17-alpine3.23",
      "sharedTags": [],
      "architectures": ["amd64", "arm32v6", "arm32v7", "arm64v8", "i386", "ppc64le", "riscv64", "s390x"],
      "baseOs": {"family": "alpine", "version": "3.23", "codename": null, "purl": "pkg:generic/alpine"},
      "source": {
        "repository": "https://github.com/docker-library/official-images",
        "commit": "c788a3606c4d0231711ae26d9e6de137e60d1002",
        "path": "library/postgres"
      }
    }
  ]
}
```

## Release codenames

An `ebb.codenames.v1` document contains a `rows` array with one row for each pair of `family` and `codename`. The families are `debian`, `ubuntu`, and `nodejs-lts`. Codenames use lowercase upstream identifiers. Debian and Node.js lines use integers represented as strings. Ubuntu uses the `YY.MM` line with its leading month zero retained. `source.url` identifies the official source and `source.accessedAt` is the calendar day it was checked in UTC.

```json
{
  "schemaVersion": "ebb.codenames.v1",
  "rows": [
    {
      "family": "debian",
      "codename": "bookworm",
      "version": "12",
      "source": {"url": "https://www.debian.org/releases/index.en.html", "accessedAt": "2026-11-28"}
    }
  ]
}
```
