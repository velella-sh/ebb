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
    - field: line
      label: Release line
    - field: vers
      label: Version range
    - field: dataVersion
      label: Signed data version
    - field: precision
      label: Date precision
    - field: standardSupport
      label: Standard support ends
    - field: extendedSupport
      label: Extended support ends
    - field: replacement
      label: Replacement
---

:::if{field=deadline}
## Support deadline

:field[deadline]. :evidence[deadline]
:::

:::if{field=ruleId}
## Lifecycle evidence

:evidence[ruleId]
:::
