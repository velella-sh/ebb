# Migrating from xeol to Ebb

Ebb provides drop-in lifecycle intelligence for teams transitioning from [xeol](https://github.com/xeol-io/xeol). Because xeol relied on external hosted services that have been discontinued ([xeol#603](https://github.com/xeol-io/xeol/issues/603), [xeol#606](https://github.com/xeol-io/xeol/issues/606), [xeol#607](https://github.com/xeol-io/xeol/issues/607)), Ebb offers an offline, cryptographically verifiable, and open alternative.

Migration requires no changes to your existing Syft workflows or downstream JSON consumers.

## One-Minute Migration

Migrating from xeol to Ebb separates artifact generation (handled by standard tooling like [Syft](https://github.com/anchore/syft)) from lifecycle evaluation (handled by Ebb).

### Local CLI Migration

**Before (xeol):**
```bash
# Scan container image directly with xeol
xeol alpine:3.14 -o json
```

**After (Syft + Ebb):**
```bash
# 1. Generate an SBOM with Syft, then pipe to Ebb:
syft alpine:3.14 -o json | ebb check-all - --format xeol-json

# Or save the SBOM to a file:
syft alpine:3.14 -o json > sbom.json
ebb check-all sbom.json --format xeol-json
```

### GitHub Actions CI Migration

**Before (`.github/workflows/scan.yml` with `xeol-action`):**
```yaml
- name: Scan image for EOL packages with Xeol
  uses: xeol-io/xeol-action@v1
  with:
    image: ${{ env.IMAGE }}
    fail-build: true
    output-format: json
```

**After (Syft + Ebb):**
```yaml
- name: Generate SBOM with Syft
  uses: anchore/sbom-action@v0
  with:
    image: ${{ env.IMAGE }}
    output-file: sbom.json

- name: Evaluate EOL lifecycle with Ebb
  run: |
    npx --yes @velella/ebb check-all sbom.json --format xeol-json --fail-on end-of-life
```

Migration time depends on which dependencies are declared and how they are supplied to Ebb.

---

## Data Freshness, Storage, and Signing

| Aspect | Xeol (v0.10.8) | Ebb |
|---|---|---|
| **Data Architecture** | Proprietary SQLite database fetched from centralized server `https://data.xeol.io` (`internal/constants.go:6`) | Open canonical Git registry (`registry/*.json`) and bundled JSON index |
| **Network Requirements** | Required periodic network connectivity to download database snapshots (`cmd/xeol/cli/options/database.go:27`) | 100% offline runtime; core library and CLI never contact external servers |
| **Integrity & Trust** | Checksum verification on download | Signed release bundles with Sigstore/Cosign keyless signatures and SLSA Level 3 provenance |
| **Refresh Mechanism** | CLI `xeol db update` | CLI `ebb data update` or automated offline bundle distribution |
| **API Keys** | Optional `--api-key` sending data to `xeol.io` | Strictly zero tracking, telemetry, or remote reporting |

---

## CLI Flags and Input Mapping

All citations reference xeol source tree at tag [`v0.10.8`](https://github.com/xeol-io/xeol/tree/v0.10.8).

| Xeol Input / Flag | Citation | Ebb Equivalent | Status / Notes |
|---|---|---|---|
| `<image>` | `cmd/xeol/cli/commands/root.go:56` | `syft <image> -o json \| ebb check-all -` | Container extraction is delegated to Syft; Ebb focuses purely on lifecycle evaluation. |
| `dir:<path>` | `cmd/xeol/cli/commands/root.go:66` | `syft dir:<path> -o json \| ebb check-all -` | Directory scanning is performed by Syft, producing a standard SBOM. |
| `sbom:<path>` | `cmd/xeol/cli/commands/root.go:67` | `ebb check-all <path>` | Native: Ebb automatically recognizes Syft JSON format. |
| `purl:<path>` | `cmd/xeol/cli/commands/root.go:69` | `ebb check-all <path>` | Native: Ebb reads line-delimited PURLs directly. |
| `-o, --output <format>` | `cmd/xeol/cli/options/xeol.go:84-87` | `--format <text\|markdown\|json\|xeol-json>` | `--format xeol-json` outputs identical xeol schema. |
| `--file <path>` | `cmd/xeol/cli/options/xeol.go:89-92` | `> <path>` | Standard UNIX shell redirection. |
| `-f, --fail-on-eol-found` | `cmd/xeol/cli/options/xeol.go:109-112` | `--fail-on end-of-life` | Exits with status 1 if any package has reached end-of-life. |
| `-l, --lookahead <dur>` | `cmd/xeol/cli/options/xeol.go:114-117` | `--as-of <date>` | Evaluates lifecycle as of a target date (e.g. today + duration). |
| `--distro <distro>:<ver>` | `cmd/xeol/cli/options/xeol.go:119-122` | Detected from Syft `distro` | Syft automatically catalogs OS distributions from `/etc/os-release`. |
| `-s, --scope <scope>` | `cmd/xeol/cli/options/xeol.go:79-82` | Syft `--scope` flag | Handled during SBOM extraction step. |
| `--platform <platform>` | `cmd/xeol/cli/options/xeol.go:124-127` | Syft `--platform` flag | Handled during SBOM extraction step. |
| `--api-key <key>` | `cmd/xeol/cli/options/xeol.go:104-107` | Not applicable | Ebb does not communicate with external APIs. |
| `--project-name <name>` | `cmd/xeol/cli/options/xeol.go:99-102` | Not applicable | Ebb is completely serverless. |
| `db update` | `cmd/xeol/cli/commands/db_update.go:16` | `ebb data update` | Updates offline bundle if network tool is invoked. |
| `db status` | `cmd/xeol/cli/commands/db_status.go:16` | `ebb data status` | Inspects local bundle freshness and metadata. |

---

## GitHub Action Inputs Mapping

Citations reference [`xeol-action/action.yml`](https://github.com/xeol-io/xeol-action/blob/main/action.yml).

| `xeol-action` Input | Citation | Syft + Ebb Action Equivalent | Notes |
|---|---|---|---|
| `image` | `action.yml:6-8` | `anchore/sbom-action: image` | Handled by Syft SBOM generator. |
| `path` | `action.yml:9-11` | `anchore/sbom-action: path` | Handled by Syft directory scanner. |
| `sbom` | `action.yml:12-14` | Passed to `ebb check-all <file>` | Direct evaluation of SBOM file. |
| `fail-build` | `action.yml:15-18` | `--fail-on end-of-life` | Default in xeol was `true`. In Ebb, specify `--fail-on end-of-life`. |
| `output-format` | `action.yml:19-22` | `--format <format>` | Supports `json`, `text`, `markdown`, and `xeol-json`. |
| `api-key` | `action.yml:23-24` | Not applicable | No account or token required. |

---

## Exit Codes

| Scenario | Xeol Exit Code | Citation | Ebb Exit Code |
|---|---|---|---|
| Clean execution (no EOL findings) | `0` | `cmd/xeol/cli/commands/root.go:92` | `0` |
| End-of-life package found (when fail flag enabled) | `1` | `xeol/xeolerr/errors.go:6` (`ErrEolFound`) | `1` |
| Invalid CLI arguments or malformed input | `1` | `cmd/xeol/cli/commands/root.go:431` | `2` (CLI error) / `1` (strict compat) |

---

## JSON Output Shape & Downstream Compatibility

Ebb's `--format xeol-json` emits the exact top-level document structure defined by xeol (`xeol/presenter/models/document.go:13-18`):

```json
{
  "matches": [
    {
      "Cycle": {
        "ProductName": "Alpine Linux",
        "ProductPermalink": "https://alpinelinux.org/releases/",
        "ReleaseCycle": "3.14",
        "Eol": "2023-05-01",
        "LatestRelease": "3.14.10",
        "LatestReleaseDate": "2022-11-10",
        "ReleaseDate": "2021-06-15"
      },
      "Package": {
        "ID": "c1f729e248b1dca5",
        "Name": "busybox",
        "Version": "1.33.1-r6",
        "Locations": {},
        "Language": "",
        "Licenses": null,
        "Type": "apk",
        "CPEs": null,
        "PURL": "pkg:apk/alpine/busybox@1.33.1-r6?arch=x86_64",
        "Upstreams": null,
        "MetadataType": "",
        "Metadata": null
      },
      "artifact": {
        "name": "busybox",
        "version": "1.33.1-r6",
        "type": "apk",
        "locations": [],
        "language": "",
        "licenses": [],
        "cpes": [],
        "purl": "pkg:apk/alpine/busybox@1.33.1-r6?arch=x86_64",
        "upstreams": []
      },
      "ebb": {
        "ruleId": "alpine-3-14",
        "evidence": "https://alpinelinux.org/releases/",
        "dataVersion": "2"
      }
    }
  ],
  "source": {
    "type": "image",
    "target": "alpine:3.14"
  },
  "distro": {
    "name": "alpine",
    "version": "3.14.0",
    "idLike": ["alpine"]
  },
  "descriptor": {
    "name": "ebb",
    "version": "0.2.1"
  }
}
```

### Output Differences Table

| Field Path | Xeol Value | Ebb Value | Rationale |
|---|---|---|---|
| `descriptor.name` | `"xeol"` (`xeol/presenter/models/descriptor.go:5`) | `"ebb"` | Accurately identifies generating tool |
| `descriptor.version` | Xeol release version | Ebb library version | Reflects active Ebb release |
| `matches[].Package.Licenses` | `null` or raw array (`xeol/presenter/models/package.go:37`) | `null` | Ebb focuses on lifecycle dates rather than license scanning |
| `matches[].Package.CPEs` | `null` or raw array (`xeol/presenter/models/package.go:32`) | `null` | CPE mapping is not retained in lifecycle evaluation |
| `matches[].Package.Upstreams` | `null` or raw array (`xeol/presenter/models/package.go:47`) | `null` | Upstream package references not queried for lifecycle |
| `matches[].ebb` | Not present | `{ ruleId, evidence, dataVersion }` | Ebb-specific audit metadata placed in isolated namespace to preserve downstream parser compatibility |

### Findings Differences on Test Runs

When comparing results between xeol and Ebb on sample images (such as `alpine:3.14` or multi-ecosystem containers):
- **Data Source Authority**: Xeol scraped endoflife.date API entries directly. Ebb uses vendor-authoritative lifecycle rules, which may report more precise minor/patch lifecycle dates.
- **Evaluation Date Reference**: Xeol evaluated against current system wall time unless `--lookahead` was supplied. Ebb allows reproducible `--as-of` pinning.
- **Unknown Components**: Syft catalogers identify more modern ecosystem packages than xeol's frozen cataloger; packages unrecognized by Ebb's rules produce a clean `ok` or positional error rather than crashing.
