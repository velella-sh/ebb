---
title: "{title}"
description: "{summary}"
layout: record
agent:
  edit: false
record:
  summary: summary
  status: status
  facts:
    - field: purl
      label: Package URL
    - field: ecosystem
      label: Ecosystem
    - field: dataVersion
      label: Signed data version
---

:::if{field=deadline}
## Earliest recorded deadline

:field[deadline] (:field[precision] precision). :evidence[deadline]
:::

:::if{field=timeline}
## Release timeline

:field[timeline]

The timeline uses **Ongoing** when an endpoint has no published date. Check the status column for the release line's support status.

:evidence[timeline]
:::

:::if{field=comparisonUrl}
:evidence[comparisonUrl]
:::

## Lifecycle rules

:evidence[ruleCount]
