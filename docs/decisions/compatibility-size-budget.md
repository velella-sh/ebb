---
title: Packed size budget for runtime compatibility
description: The npm tarball size limit for bundled runtime compatibility tables.
layout: doc
permalink: /decisions/compatibility-size-budget/
---

The compatibility subpath and MCP tool read the same bundled tables offline. The tables include 113 documented rows and declared runtime ranges for 13,651 exact npm and PyPI releases. The declared table contributes about 48 KB after gzip compression.

The combined build with infrastructure, prediction, image metadata, npm coverage, and compatibility tables measured 619,302 bytes packed. Increase the cap from 556,000 to 622,000 bytes. The static API index and total site data limits stay the same. [Framework runtime compatibility](/runtime-support/)
