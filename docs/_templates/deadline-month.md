---
title: "{title} lifecycle deadlines"
description: "{summary}"
layout: record
agent:
  edit: false
record:
  facts:
    - field: dataVersion
      label: Signed data version
    - field: count
      label: Scheduled deadlines
      kind: number
---

::link-card{href="/deadlines/" title="All deadline months"}

## Deadlines

:field[agenda]

:::if{field=count}
## Sources

:evidence[agenda]
:::
