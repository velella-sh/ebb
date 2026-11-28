---
title: Packed size budget for runtime compatibility
description: The npm tarball size limit for bundled runtime compatibility tables.
layout: doc
permalink: /decisions/compatibility-size-budget/
---

The compatibility subpath and MCP tool read the same bundled tables offline. The tables include 113 documented rows and declared runtime ranges for 13,649 exact npm and PyPI releases. The declared table contributes about 48 KB after gzip compression.

The preceding infrastructure build measured 554,252 bytes packed. With compatibility tables, the build measured 612,452 bytes. Increase the cap from 556,000 to 615,000 bytes. The static API index and total site data limits stay the same. [Framework runtime compatibility](/runtime-support/)
