---
title: Package size budget for structured successors
description: Budget impact measured for the structured successor data update.
layout: doc
permalink: /decisions/successor-data-budget/
---

The November 28 registry shipped a 549,479-byte tarball with a 550,000-byte ceiling. Adding structured successor targets to 201 existing records brings the packed size to 559,524 bytes. This dataset is included as registry JSON and as the existing generated ecosystem modules for offline readers.

Set the packed size cap to 561,000 bytes. The change covers the measured data growth and leaves roughly 1.5 KB of space. Measure with `npm run size` after a clean build. Ebb still has zero runtime dependencies.
