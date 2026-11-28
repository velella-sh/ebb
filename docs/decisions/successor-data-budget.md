---
title: Package size budget for structured successors
description: Budget impact measured for the structured successor data update.
layout: doc
permalink: /decisions/successor-data-budget/
---

The infrastructure registry brought the packed size to 554,252 bytes with a 556,000-byte ceiling. Adding structured successor targets to 259 existing records brings the packed size to about 567,125 bytes. This dataset ships as registry JSON and existing generated ecosystem modules for offline readers.

Set the packed size cap to 569,000 bytes. The change covers the measured data growth and leaves roughly 1.9 KB of space. Measure with `npm run size` after a clean build. Ebb still has zero runtime dependencies.
