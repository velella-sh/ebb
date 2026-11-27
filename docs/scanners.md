---
title: "Scanner Bridge (Trivy & Grype)"
description: "Pair Trivy and Grype container and filesystem vulnerability scan reports with Ebb lifecycle intelligence."
layout: doc
permalink: /scanners/
---

# Scanner Bridge (Trivy & Grype)

Ebb bridges with vulnerability scanners—including [Aqua Security Trivy](https://github.com/aquasecurity/trivy) and [Anchore Grype](https://github.com/anchore/grype)—to correlate known security vulnerabilities with software lifecycle milestones, end-of-life runtimes, and deprecated packages.

Ebb does not modify or drop any scanner findings; it extracts package identifiers and Package URLs (PURLs), evaluates them against Ebb's offline lifecycle registry, and produces a consolidated lifecycle section alongside scanner output.

---

## Shortest paths to run

### 1. Trivy plugin (one-command run)

Install the pre-packaged Trivy plugin and run it against any container image:

```bash
# Install plugin from release asset archive
trivy plugin install https://github.com/velella-sh/ebb/releases/download/v0.2.1/ebb-trivy-plugin.tar.gz

# Scan container image for vulnerabilities and lifecycle status
trivy ebb image alpine:3.14
```

### 2. Grype pipeline (standard pipe)

Pipe Grype's JSON output directly into Ebb:

```bash
# Scan image with Grype and bridge to Ebb
grype alpine:3.14 -o json | ebb bridge grype -
```

For a comprehensive inventory scan including packages without known CVEs, generate a Syft document:

```bash
# Full inventory lifecycle evaluation with Syft and Grype
syft alpine:3.14 -o json | ebb bridge grype -
```

---

## Scanner Data Formats & PURL Discovery

### Aqua Security Trivy (v0.60.0)

- **Official documentation**: [Trivy JSON format](https://aquasecurity.github.io/trivy/v0.60/docs/configuration/reporting/#json)
- **Package list location**: `Results[].Packages[]` in Trivy JSON output.
  - *Requirement*: Trivy must be executed with `--list-all-pkgs` when targeting full inventories; without this flag, Trivy only emits packages that have matching CVE vulnerabilities in `Results[].Vulnerabilities[]`.
- **PURL location**: `Results[].Packages[].Identifier.PURL` (or `PURL` on legacy structures). Each package also provides `ID` (e.g. `musl@1.2.2-r3`), `Name`, and `Version`.
- **Operating system detection**: `Metadata.OS.Family` and `Metadata.OS.Name`. Ebb transforms these into standard OS generic Package URLs (e.g. `pkg:generic/alpine@3.14.0`) to check container base image end-of-life status.
- **CycloneDX output**: `components[].purl` with `components[].version`.

#### Trivy Plugin Architecture

- **Plugin specification**: [Trivy Plugin Documentation](https://aquasecurity.github.io/trivy/v0.60/docs/advanced/plugins/)
- **Manifest (`plugin.yaml`)**: Declares plugin metadata, target execution platforms, and entry point binary scripts.
- **Installation**: `trivy plugin install <repo-url-or-archive-url>`. Trivy downloads and unpacks the archive into `$XDG_DATA_HOME/trivy/plugins/<name>`.
- **Execution & arguments**: When invoking `trivy <plugin-name> [subcommand] [flags]`, Trivy forwards all trailing arguments directly to the configured executable script without running its own scanning engine. The Ebb wrapper runs `trivy "$@" --format json --list-all-pkgs` and pipes the output into `ebb bridge trivy -`.

---

### Anchore Grype (v0.87.0)

- **Official documentation**: [Grype Output Formats](https://github.com/anchore/grype#output-formats)
- **Package list location**: `matches[].artifact` in Grype JSON output.
- **PURL location**: `matches[].artifact.purl`. Artifacts include `id` (hash), `name`, `version`, and `type`.
- **Distro detection**: Top-level `distro.name` and `distro.version` (e.g. `alpine` and `3.14.0`). Ebb maps this to `pkg:generic/<distro>@<version>`.
- **Why Grype needs an SBOM or CycloneDX for full inventory**:
  Grype is purely a vulnerability matcher: its default report format outputs only artifacts that matched a known vulnerability rule. Non-vulnerable packages are intentionally absent from `matches[]`. Because software lifecycle status (such as approaching deprecation or end-of-life) applies regardless of active vulnerabilities, Ebb's Grype bridge also accepts Syft JSON documents (`artifacts[].purl`) to evaluate the full inventory of the scanned target.
- **Extensibility**: Grype has no native plugin system. It provides Go templates (`-o template -t <template>`) allowing consumers to render specific fields, but custom analysis steps run as post-processing pipes like `ebb bridge grype <report>`.

---

## Report Output

The `ebb bridge` command outputs lifecycle intelligence in either `markdown` (default) or `json`.

### Markdown output

```
### Ebb Lifecycle Bridge Summary (trivy)

Target: alpine:3.14
Scanner: trivy (v0.60.0)

| Metric | Count |
| :--- | :--- |
| **Total Checked** | 15 |
| ❌ **end-of-life** | 1 |
| ❌ **deprecated** | 0 |
| ❓ **unknown** | 14 |
| ⚠️ **without purl** | 0 |

#### Lifecycle Findings

| Target | Package ID | PURL | Status | Deadline | Replacement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| alpine:3.14 | os:alpine | pkg:generic/alpine@3.14.0 | ❌ end-of-life | 2026-04-01 | Alpine Linux 3.21 or later |
```

### JSON output

When run with `--format json`, the combined report preserves all original scanner findings and appends:

- `scanner`: `"trivy"` or `"grype"`
- `scannerVersion`: Pinned or detected scanner version
- `counts`: Breakdown of packages checked, end-of-life, deprecated, unknown, and without PURL
- `lifecycle`: Positional lifecycle items pointing back to the scanner's own `packageId`

---

## Automated Verification in CI

The integration between Trivy, Grype, and Ebb is continuously verified against pinned container image digests in GitHub Actions:
- See the automated workflow: [.github/workflows/scanner-e2e.yml](https://github.com/velella-sh/ebb/blob/main/.github/workflows/scanner-e2e.yml)
