---
title: "{title}"
description: "{summary}"
version: "{dataVersion}"
layout: record
agent:
  edit: false
record:
  summary: summary
  facts:
    - field: dataVersion
      label: Signed data version
    - field: createdAt
      label: Bundle created at (UTC)
    - field: releaseUrl
      label: Published release and verification assets
      kind: url
    - field: bundleSha256
      label: Bundle SHA-256
    - field: contentDigest
      label: Content digest
---
