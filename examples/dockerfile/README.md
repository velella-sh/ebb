# Checking Dockerfile Base Images with Ebb

This example demonstrates how to evaluate container base images in a `Dockerfile` against Ebb's container lifecycle rules.

## Overview

Container images like `node:16-alpine` or `python:3.7-slim` often remain in Dockerfiles long after upstream security patches and runtime maintenance have ceased. Ebb tracks official container and runtime lifecycle schedules across Docker Hub, OCI registries, Debian, Alpine, Ubuntu, and Red Hat.

## Running the Example

Run the scanner script:

```bash
node --experimental-strip-types examples/dockerfile/check-dockerfile.ts
```

Or pass a path to your own Dockerfile:

```bash
node --experimental-strip-types examples/dockerfile/check-dockerfile.ts ./Dockerfile
```

## How It Works

The script extracts `FROM` directives, extracts the image tag and major/minor release number, normalizes to a standard Docker purl (`pkg:docker/library/<image>@<version>`), and evaluates it with `check()`:

```ts
import { check, replacementFor } from "@velella/ebb";

// Evaluates node:16-alpine
const result = check("pkg:docker/library/node", "16");
console.log(result.status); // "end-of-life"

const replacement = replacementFor("pkg:docker/library/node", "16");
console.log(replacement);   // "A node image on a supported release line, such as node:22"
```

## CLI Alternative

You can also evaluate container images directly via CLI:

```bash
npx @velella/ebb check pkg:docker/library/node 16
npx @velella/ebb check pkg:docker/library/python 3.7
```
