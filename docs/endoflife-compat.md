---
layout: doc
title: endoflife.date compatibility
permalink: /endoflife-compat/
---

# endoflife.date compatibility

Use Ebb's lifecycle data with clients that accept the endoflife.date product response shape.
Specify `https://velella.sh/ebb/api/eol-compat/v1` as the base URL and request
`products/<id>.json`. The equivalent extensionless product path works for clients that
construct their own URLs. Discover the available files in
[the product list](https://velella.sh/ebb/api/eol-compat/v1/products.json).

The initial product IDs are `dotnet`, `go`, `kubernetes`, `nodejs`, `php`, `postgresql`,
`python`, and `ruby`. An unknown product returns HTTP 404.
The product list contains only IDs with at least one release line supported by an Ebb rule.
It does not enumerate all components or release lines from either project.

## Release fields

Ebb uses only registry rules recording an event for a single release line. A rule for a
range of several releases or for an API use does not define a product release here.
When multiple rules name the same phase for the same line, the earliest recorded date wins.

| Field | Ebb source |
| --- | --- |
| `name`, `label` | Release line identified by the rule's VERS range, e.g. `22` or `3.12`. .NET 5 and later use their major version as the cycle identifier. |
| `eoasFrom`, `isEoas` | End of active support. The flag is true from the date inclusive. |
| `eolFrom`, `isEol` | End of life, scheduled end of life, or end of standard support. The flag is true from the date inclusive, or when the rule confirms the end without a date. |
| `eoesFrom`, `isEoes` | End of extended support. The flag is true from the date inclusive. |
| `isMaintained` | True while a recorded standard or extended support phase is open. False when a recorded end has passed and no known phase remains open. |
| `custom.ebbRuleUrl` | Link to the Ebb rule for standard, extended or active support, in that order when present. The rule links to its underlying evidence. |
| `codename`, `releaseDate`, `isLts`, `ltsFrom`, `latest`, `isDiscontinued`, `discontinuedFrom` | Ebb's lifecycle rules do not record these fields. Their values are null. |

The flags are evaluated on the response's `generated_at` UTC date.
Unknown dates and states are null. Clients that require non-null release dates or boolean
flags may reject an incomplete response. Ebb's coverage and dates come from its own
registry and the evidence linked from it. The [endoflife.date v1 API](https://endoflife.date/docs/api/v1/)
provides the shape and product identifiers.

## Renovate

Renovate 45.3.2's built-in [`endoflife-date` datasource](https://docs.renovatebot.com/modules/datasource/endoflife-date/)
expects a legacy array. For that datasource, set `registryUrls` to the separately generated
`https://velella.sh/ebb/api/eol-compat/v1/renovate` path:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["endoflife-date"],
      "registryUrls": ["https://velella.sh/ebb/api/eol-compat/v1/renovate"]
    }
  ]
}
```

The legacy response provides known release lines as `cycle` and sets `eol` to the recorded
date or to `true` for a confirmed end without a date. When all you want is Ebb lifecycle information on Renovate's normal dependency
lookups, use the [Ebb Renovate preset](../renovate/) instead.
