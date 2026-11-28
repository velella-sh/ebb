---
title: Lifecycle timeline cards
description: Embed Ebb release-line timelines in a README or on a website.
layout: doc
permalink: /cards/
---

# Lifecycle timeline cards

Ebb publishes static SVGs for components with dated release-line evidence. Use them in a README, documentation page, or website.

## Embed a card

Copy this Markdown into your README.

```md
[![Node.js release lifecycle timeline](https://velella.sh/ebb/api/v1/cards/generic/nodejs.svg)](https://velella.sh/ebb/api/v1/generic/nodejs.json)
```

Use this HTML on a website.

```html
<a href="https://velella.sh/ebb/api/v1/generic/ubuntu.json">
  <img src="https://velella.sh/ebb/api/v1/cards/generic/ubuntu.svg"
       alt="Ubuntu release lifecycle timeline">
</a>
```

## Find a card

Look up the component's normalized Package URL in the [API index](https://velella.sh/ebb/api/v1/index.json). When its entry has a `card`, append `card.path` to `https://velella.sh/ebb/api/v1/`. The entry also contains the raw SVG's SHA-256 digest and byte count. Scoped and namespaced components keep the namespace in the path, for example `cards/<type>/<namespace>/<name>.svg`.

## Read a card

The vertical dotted line marks the UTC reference date in the API build. By default it is the latest review date in the data used for the build. Compare the ends of the rows to the marker to see what is still ahead as of that date.

A solid bar connects known support dates. A dot can mark a date with no other evidenced endpoint. The maintenance segment shows a separately documented phase, such as Node.js Maintenance or PHP security support. On Ubuntu, standard refers to Standard Security Maintenance, and optional extended coverage includes Ubuntu Pro and the Legacy add-on when Canonical lists them. The vendor's source explains eligibility and coverage. Labels keep month-level dates when the source gives only a month.

A dashed segment and its thinner uncertainty range show an [Ebb prediction](predict.md) with its confidence. An announced end date takes priority. Each card includes up to eight release lines and provides a text description with the dates that are shown. Open the SVG directly to follow its source link.
