---
title: Packed size budget for infrastructure data
description: Why the npm tarball limit increased for the infrastructure registry.
layout: doc
permalink: /decisions/infrastructure-size-budget/
---

The infrastructure registry ships as canonical JSON for Node and as a generated module for browser, edge, and per-ecosystem imports. The 22 source-backed rules add roughly 4.8 KB to the compressed npm tarball. The baseline packed size was 549,479 bytes in CI. With infrastructure data, a local build measured 554,252 bytes.

Increase the packed limit from 550,000 to 556,000 bytes. This keeps the existing package entry points and leaves about 1.7 KB for routine updates. The static API and site data limits stay the same. [Infrastructure lifecycle coverage](https://velella.sh/ebb/coverage/#infrastructure-lifecycle-coverage)
