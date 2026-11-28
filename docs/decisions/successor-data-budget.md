---
title: Package size budget for structured successors
description: Budget impact measured for the structured successor data update.
layout: doc
permalink: /decisions/successor-data-budget/
---

The compatibility tables raised the previous packed size limit to 622,000 bytes. With the latest npm coverage and the 420 additional structured successor records, the combined tarball measured approximately 633,016 bytes. The registry ships as JSON and existing generated ecosystem modules for offline readers.

Set the packed size cap to 635,000 bytes. The change covers the measured data growth and leaves about 2 KB of space. Measure with `npm run size` after a clean build. The runtime dependency count and static API and site limits stay the same.
