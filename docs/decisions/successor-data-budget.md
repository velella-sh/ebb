---
title: Package size budget for structured successors
description: Budget impact measured for the structured successor data update.
layout: doc
permalink: /decisions/successor-data-budget/
---

With the infrastructure, prediction, image metadata, npm coverage, and compatibility changes, the npm tarball measured 619,302 bytes against a 622,000-byte cap. Adding structured targets to 259 existing records brings the combined tarball to about 626,039 bytes. The registry ships as JSON and existing generated ecosystem modules for offline readers.

Set the packed size cap to 628,000 bytes. The change covers the measured data growth and leaves about 2 KB of space. Measure with `npm run size` after a clean build. The runtime dependency count and static API and site limits stay the same.
