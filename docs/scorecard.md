---
title: OpenSSF Scorecard and release trust
description: Published Scorecard results, workflow check evidence and outstanding release-trust work.
layout: doc
permalink: /scorecard/
---

The [release-trust roadmap](https://github.com/velella-sh/ebb/issues/669) sets a release target of 7. It recorded a score of **5** for `862a418` on 26 November 2026. The [corresponding workflow run](https://github.com/velella-sh/ebb/actions/runs/45801274882) retains a branch-protection SARIF result. The public API serves the latest run, so the check-by-check baseline below comes from the later response.

The published [OpenSSF API response](https://api.securityscorecards.dev/projects/github.com/velella-sh/ebb) read on 28 November 2026 was **4.1** for commit `e199df7` at 04:48:02 UTC, using Scorecard v5.7.0. `—` means the engine could not score the check. A malformed YAML heredoc in the pre-commit workflow blocked five checks at the baseline.

| Check | Baseline | Evidence and next step |
| --- | ---: | --- |
| Binary-Artifacts | 10 | Scorecard detected no build executables in source. |
| Branch-Protection | 0 | `main` was unprotected and no ruleset was returned by the public API. The owner controls migration and settings in [#722](https://github.com/velella-sh/ebb/issues/722). |
| CI-Tests | 10 | Scorecard found CI for all 13 merged PRs it sampled. |
| CII-Best-Practices | 0 | Badge enrollment and the evidence questionnaire remain with the owner in [#724](https://github.com/velella-sh/ebb/issues/724). |
| Code-Review | 0 | The baseline found no qualifying approval in 13 merged changes. One maintainer cannot independently approve changes attributed to the same actor. A contributor identity and review requirement are owner decisions in [#722](https://github.com/velella-sh/ebb/issues/722). |
| Contributors | 6 | Scorecard identified two contributor affiliations. The project relies on one primary maintainer. |
| Dangerous-Workflow | — | The parser repair in [#720](https://github.com/velella-sh/ebb/issues/720) restored this check. The local candidate scored 10. |
| Dependency-Update-Tool | 10 | Dependabot already checks GitHub Actions and npm every week. |
| Fuzzing | 0 | Scorecard found no recognized integration. Ebb has property tests under `tests/`. Adding a recognized fuzzer requires a dedicated project that exercises actual parser inputs. |
| License | 10 | The source is MIT licensed. |
| Maintained | 0 | Scorecard records age under 90 days. Recheck after the age threshold. |
| Packaging | — | [#720](https://github.com/velella-sh/ebb/issues/720) restored YAML parsing. Local Scorecard detected the packaging workflow (10). |
| Pinned-Dependencies | — | All 80 detected remote action references use full commit hashes after [#720](https://github.com/velella-sh/ebb/issues/720). The local score is 7 because the check also counts three example/fixture container images, four npm command installs, the pinned-version pip install lacking hashes and the Trivy installer download. Those remaining inputs are described below. |
| SAST | — | [#720](https://github.com/velella-sh/ebb/issues/720) restored parsing, and the local check recognized CodeQL (10). |
| Security-Policy | 4 | The baseline lacked linked guidance. The amended policy covers private reporting, versions, supported surfaces and release verification ([#723](https://github.com/velella-sh/ebb/issues/723), local candidate 10). |
| Signed-Releases | 8 | The lone data release has a verifiable Cosign signature. Package build attestations and a public post-release check remain in [#755](https://github.com/velella-sh/ebb/issues/755) and [#776](https://github.com/velella-sh/ebb/issues/776). |
| Token-Permissions | — | The candidate scores 10 after restoring YAML parsing and moving writes to jobs that publish artifacts or update repository state ([#720](https://github.com/velella-sh/ebb/issues/720)). |
| Vulnerabilities | 0 | The baseline lists 46 OSV entries across the repository scan. The separate npm tree and proposed maintenance are detailed below ([#721](https://github.com/velella-sh/ebb/issues/721), [#796](https://github.com/velella-sh/ebb/issues/796)). |

## Verify the candidate's file-based checks

From a checkout of this change, run OpenSSF [Scorecard v5.7.0](https://github.com/ossf/scorecard/releases/tag/v5.7.0):

```bash
scorecard --local . --show-details --checks=Dangerous-Workflow,Packaging,Pinned-Dependencies,SAST,Security-Policy,Token-Permissions
```

The local scan measures repository files. The published workflow uses GitHub's protected result-publication context on `main`. Use its commit and timestamp when comparing the [public result](https://api.securityscorecards.dev/projects/github.com/velella-sh/ebb).

The remaining pin findings cover inputs beyond GitHub Action references. The Dockerfiles demonstrate older lifecycle lines or provide fixed scanner test cases. A maintenance change can lock their existing image digests while preserving those cases. Lock the standalone npm and Python installs separately; the existing command installs include temporary site tooling and integration checks that are not part of the package lockfile. Replace the Trivy installer download with a checksum-verified installer once its release inputs are recorded and available. The README badge threshold remains in [#796](https://github.com/velella-sh/ebb/issues/796).

## npm advisories

On 28 November 2026, `npm audit` detected one transitively affected dependency path: the dev-only Cloudflare test emulator `miniflare@4.20260730.0` pins `sharp@0.35.2`. The advisory for bundled libheif is fixed in `0.35.4` and the one for bundled librsvg in `0.35.5`. [libheif advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c) · [librsvg advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)

`npm audit fix --package-lock-only --dry-run --ignore-scripts` proposed no lockfile changes. The newest `miniflare` in the current range and the inspected v5 prerelease both pin the same vulnerable `sharp` version. The audit's forced proposal uses a `miniflare` version below the supported range. `npm audit --omit=dev` reported zero advisories. Select and test a compatible emulator upgrade or a reviewed transitive override under [#796](https://github.com/velella-sh/ebb/issues/796). This result applies to the npm install tree and does not resolve the public Scorecard OSV findings.

### Advisory IDs in the published baseline

The 46 reported entries are listed here for comparing future scans. This list reflects the Scorecard repository scan. npm separately reports the install-tree paths above.

[PYSEC-2019-10](https://osv.dev/PYSEC-2019-10), [PYSEC-2019-11](https://osv.dev/PYSEC-2019-11), [PYSEC-2019-12](https://osv.dev/PYSEC-2019-12), [PYSEC-2019-13](https://osv.dev/PYSEC-2019-13), [PYSEC-2019-14](https://osv.dev/PYSEC-2019-14), [PYSEC-2019-15](https://osv.dev/PYSEC-2019-15), [PYSEC-2019-16](https://osv.dev/PYSEC-2019-16), [PYSEC-2019-79](https://osv.dev/PYSEC-2019-79), [PYSEC-2020-31](https://osv.dev/PYSEC-2020-31), [PYSEC-2020-32](https://osv.dev/PYSEC-2020-32), [PYSEC-2020-33](https://osv.dev/PYSEC-2020-33), [PYSEC-2020-34](https://osv.dev/PYSEC-2020-34), [PYSEC-2020-35](https://osv.dev/PYSEC-2020-35), [PYSEC-2020-36](https://osv.dev/PYSEC-2020-36), [PYSEC-2021-439](https://osv.dev/PYSEC-2021-439), [PYSEC-2021-6](https://osv.dev/PYSEC-2021-6), [PYSEC-2021-7](https://osv.dev/PYSEC-2021-7), [PYSEC-2021-8](https://osv.dev/PYSEC-2021-8), [PYSEC-2021-9](https://osv.dev/PYSEC-2021-9), [PYSEC-2021-98](https://osv.dev/PYSEC-2021-98), [PYSEC-2021-99](https://osv.dev/PYSEC-2021-99), [PYSEC-2022-1](https://osv.dev/PYSEC-2022-1), [PYSEC-2022-19](https://osv.dev/PYSEC-2022-19), [PYSEC-2022-190](https://osv.dev/PYSEC-2022-190), [PYSEC-2022-191](https://osv.dev/PYSEC-2022-191), [PYSEC-2022-2](https://osv.dev/PYSEC-2022-2), [PYSEC-2022-20](https://osv.dev/PYSEC-2022-20), [PYSEC-2022-3](https://osv.dev/PYSEC-2022-3), [PYSEC-2026-1297](https://osv.dev/PYSEC-2026-1297), [PYSEC-2026-3717](https://osv.dev/PYSEC-2026-3717), [PYSEC-2026-4035](https://osv.dev/PYSEC-2026-4035), [PYSEC-2026-628](https://osv.dev/PYSEC-2026-628), [GHSA-3h9f-r86x-qvjx](https://osv.dev/GHSA-3h9f-r86x-qvjx), [GHSA-6w2r-r2m5-xq5w](https://osv.dev/GHSA-6w2r-r2m5-xq5w), [GHSA-7xr5-9hcq-chf9](https://osv.dev/GHSA-7xr5-9hcq-chf9), [GHSA-8cjm-8mp7-r2xf](https://osv.dev/GHSA-8cjm-8mp7-r2xf), [GHSA-8qcx-xf44-272x](https://osv.dev/GHSA-8qcx-xf44-272x), [GHSA-8x94-hmjh-97hq](https://osv.dev/GHSA-8x94-hmjh-97hq), [GHSA-923m-gv2p-w5qp](https://osv.dev/GHSA-923m-gv2p-w5qp), [GHSA-crhf-3pfg-w68w](https://osv.dev/GHSA-crhf-3pfg-w68w), [GHSA-frmv-pr5f-9mcr](https://osv.dev/GHSA-frmv-pr5f-9mcr), [GHSA-h7pc-vwp9-298g](https://osv.dev/GHSA-h7pc-vwp9-298g), [GHSA-qw25-v68c-qjf3](https://osv.dev/GHSA-qw25-v68c-qjf3), [GHSA-p8p7-x288-28g6](https://osv.dev/GHSA-p8p7-x288-28g6), [GHSA-rgj7-g3m4-5g8c](https://osv.dev/GHSA-rgj7-g3m4-5g8c), [GHSA-wq5f-xc86-pv6w](https://osv.dev/GHSA-wq5f-xc86-pv6w).

## Record release metrics

```bash
npm run build
node dist/tools/growth-snapshot.js --stdout
node dist/tools/growth-snapshot.js
```

The final command appends a dated entry to [`metrics/releases.json`](https://github.com/velella-sh/ebb/blob/main/metrics/releases.json). Counts come from the public GitHub repository and dependency graph, npm's package and downloads endpoints, and the [documented integrations list](https://github.com/velella-sh/ebb/blob/main/metrics/integrations.json). GitHub's count is approximate. npm's public package response currently omits a dependents count, so the corresponding value is `null`. A missing metric and an observed zero are distinct. The 26 November baseline uses the figures in [#686](https://github.com/velella-sh/ebb/issues/686). Subsequent entries record the time observed, and can be captured after a release without a personal token.
