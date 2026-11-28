# Check CycloneDX components with Ebb

From `readers/go` in a repository checkout, run the example with the two checked-in registries used by the CycloneDX fixture.

```bash
go run ./examples/sbom \
  -registry ../../registry/npm.json \
  -registry ../../registry/python.json \
  ../../examples/cyclonedx/bom.json
```

The fixture produces these findings.

```text
pkg:npm/left-pad@1.3.0 deprecated
  https://www.npmjs.com/package/left-pad (accessed 2026-10-13)
pkg:npm/request@2.88.2 deprecated 2020-02-11
  https://www.npmjs.com/package/request (accessed 2026-10-13)
pkg:pypi/django@2.2.0 end-of-life 2022-04-11
  https://www.djangoproject.com/download/#supported-versions (accessed 2026-10-21)
  https://docs.djangoproject.com/en/2.2/releases/2.2.28/ (accessed 2026-10-21)
  https://docs.djangoproject.com/en/5.2/howto/upgrade-version/ (accessed 2026-10-21)
```

Using the same registry inputs, `../../examples/pre-commit/sbom-pass.json` produces no findings. `../../examples/pre-commit/sbom-fail.json` produces the following.

```text
pkg:npm/node-sass@9.0.0 end-of-life 2024-07-24
  https://sass-lang.com/blog/node-sass-is-end-of-life/ (accessed 2026-10-16)
pkg:npm/node-sass@9.0.0 deprecated
  https://www.npmjs.com/package/node-sass (accessed 2026-10-30)
  https://registry.npmjs.org/node-sass (accessed 2026-10-30)
```

A scanner can build one `ebb.Checker` after selecting its data snapshot and reuse it after extracting component PURLs and versions. An explicitly supplied component version takes precedence over the version in a PURL. Pass forward the matched events and their evidence as lifecycle findings. Preserve unknown coverage and comparison errors separately from a comparable version with no matching rule. Components without a PURL have no lifecycle verdict.

The example also accepts `-bundle PATH -sha256 DIGEST`. Use the verified release log to obtain the digest before loading a downloaded bundle. [Release verification](https://velella.sh/ebb/verify/)
