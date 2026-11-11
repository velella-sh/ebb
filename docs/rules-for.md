---
title: "Rules and replacements"
description: "Synchronously list every active lifecycle rule for a component with rulesFor, and resolve normalised replacement PURLs or guidance with replacementFor."
layout: doc
permalink: /rules-for/
---

Ebb provides two synchronous, offline helpers on top of its active-data index:

- [`rulesFor(purl, options?)`](https://github.com/velella-sh/ebb/blob/main/src/rules-for.ts) returns every active lifecycle rule for a component, ordered by version range start (oldest first, ties broken cleanly by `rule.id`).
- [`replacementFor(purl, version)`](https://github.com/velella-sh/ebb/blob/main/src/replacement.ts) evaluates `purl` at `version` through [`check`](https://github.com/velella-sh/ebb/blob/main/src/check.ts) and returns the highest-precedence suggested replacement, returning a normalised PURL when a rule names a package replacement.

```ts
import { rulesFor } from "@velella/ebb/rules-for";
import { replacementFor } from "@velella/ebb/replacement";
```

By design, neither function reads arbitrary project files or accesses the network; only the first lookup reads Ebb's active local rule bundle, and later calls reuse the warm index.

## Listing rules with `rulesFor`

`rulesFor(purl, options?)` accepts any PURL string (normalised through [`src/purl.ts`](https://github.com/velella-sh/ebb/blob/main/src/purl.ts)) and returns a fresh array of matching [`RegistryV2Rule`](https://github.com/velella-sh/ebb/blob/main/src/registry.ts) records, including symbol-level rules. Unknown or unflagged components return `[]`.

The example below looks up `pkg:npm/@angular/core` (whose rules are stored newest-first in `registry/npm.json`) and also filters to `"end-of-support"`:

```ts
import { rulesFor } from "@velella/ebb/rules-for";

const all = rulesFor("pkg:npm/@angular/core");
const unsupported = rulesFor("pkg:npm/@angular/core", { event: "end-of-support" });

console.log(
  JSON.stringify(
    {
      allIds: all.map((rule) => rule.id),
      unsupported: unsupported.map((rule) => ({
        id: rule.id,
        vers: rule.vers,
        event: rule.event,
        replacement: rule.replacement ?? null,
      })),
    },
    null,
    2,
  ),
);
```

Output:

```json
{
  "allIds": [
    "npm.package.angular.core.v18-and-older.end-of-support",
    "npm.package.angular.core.v19.end-of-support",
    "npm.package.angular.core.v20.scheduled-end-of-life",
    "npm.package.angular.core.v21.scheduled-end-of-life",
    "npm.package.angular.core.v22.scheduled-end-of-life"
  ],
  "unsupported": [
    {
      "id": "npm.package.angular.core.v18-and-older.end-of-support",
      "vers": "vers:npm/<19.0.0-0",
      "event": "end-of-support",
      "replacement": "@angular/core@22"
    },
    {
      "id": "npm.package.angular.core.v19.end-of-support",
      "vers": "vers:npm/>=19.0.0-0|<20.0.0-0",
      "event": "end-of-support",
      "replacement": "@angular/core@22"
    }
  ]
}
```

## Resolving replacements with `replacementFor`

`replacementFor(purl, version)` delegates version matching and match precedence to [`check(purl, version)`](result-model.md) and picks the first non-empty replacement:

- When a rule names a replacement package or an explicit `pkg:` URL, `replacementFor` returns a canonical PURL validated with [`src/purl.ts`](https://github.com/velella-sh/ebb/blob/main/src/purl.ts).
- When a rule gives prose advice, a URL, or a non-package API identifier, it returns that string unchanged.
- When no rule matches, or when the matching rules omit a replacement, it returns `null` (never `""`) without throwing.

```ts
import { replacementFor } from "@velella/ebb/replacement";

console.log(
  JSON.stringify(
    {
      nodeSass: replacementFor("pkg:npm/node-sass", "9.0.0"),
      babelEs2015: replacementFor("pkg:npm/babel-preset-es2015", "6.24.1"),
      request: replacementFor("pkg:npm/request", "2.88.2"),
      mongodb: replacementFor("pkg:generic/mongodb", "5.0.0"),
      express: replacementFor("pkg:npm/express", "4.21.0"),
    },
    null,
    2,
  ),
);
```

Output:

```json
{
  "nodeSass": "pkg:npm/sass",
  "babelEs2015": "pkg:npm/%40babel/preset-env",
  "request": "Native fetch or a maintained HTTP client",
  "mongodb": null,
  "express": null
}
```

## API, options, and errors

[`src/rules-for.ts`](https://github.com/velella-sh/ebb/blob/main/src/rules-for.ts) and [`src/replacement.ts`](https://github.com/velella-sh/ebb/blob/main/src/replacement.ts) export:

| Symbol | Module | Role |
| --- | --- | --- |
| `rulesFor(purl, options?)` | `@velella/ebb/rules-for` | Returns `Rule[]` sorted oldest-first by range start, then by `rule.id`, optionally filtered by `options.event`. |
| `replacementFor(purl, version)` | `@velella/ebb/replacement` | Returns the normalised replacement PURL or guidance string for the highest-precedence match, or `null`. |
| `Rule` | `@velella/ebb/rules-for` | Alias of `RegistryV2Rule`. |
| `RuleEvent` | `@velella/ebb/rules-for` | Allowed `{ event }` values: `"deprecated"`, `"end-of-support"`, `"end-of-life"`, `"removed"`, `"scheduled-end-of-life"`. |
| `RulesForOptions` | `@velella/ebb/rules-for` | `{ event?: RuleEvent }` |
| `RulesForError` | `@velella/ebb/rules-for` | Thrown when `options.event` is not a valid lifecycle event. |

### Error behavior

| Error | Thrown by | When |
| --- | --- | --- |
| `PurlError` | `rulesFor`, `replacementFor` | Input PURL is malformed (or an explicit `pkg:` replacement PURL in custom data is invalid). |
| `RulesForError` | `rulesFor` | `options.event` is not one of the five registry lifecycle events. |
| `VersError` | `replacementFor` | `version` is empty or invalid for the matched rule's version scheme. |
| `CheckError` | `replacementFor` | Bare product name (without `pkg:`) is unknown or ambiguous. |
