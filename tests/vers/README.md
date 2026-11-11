# VERS test suite

Official [VERS (vers-spec)](https://github.com/package-url/vers-spec) conformance vectors, vendored for Ebb.

## Source

- Upstream: https://github.com/package-url/vers-spec
- Pinned version: `v1.2.1` (commit `76c729180ce3ffb24b2e9f90e34585150fe0ffcf`)
- Suite tree: https://github.com/package-url/vers-spec/tree/v1.2.1/tests
- License (MIT): https://github.com/package-url/vers-spec/blob/v1.2.1/LICENSE

`fixtures/*.json` are copied unchanged from that tag's `tests/` directory. `fixtures/LICENSE` is the upstream MIT license from the same tag.

## Upstream inconsistencies

`upstream-inconsistencies.json` lists vendored fixture cases whose `expected_output` contradicts normative [Clause 5](https://github.com/package-url/vers-spec/blob/v1.2.1/docs/standard/Clause-5-VERS-Specification.md) or preserves inconsistent string casing (shrink-only). The suite runner requires those cases to keep disagreeing with the raw fixture string while passing Ebb's conforming alternative check; verified entries count toward `vers-spec pass rate: N/M`.

| Case | Fixture expects | Ebb does | Specification |
| --- | --- | --- | --- |
| `nuget_version_cmp_test.json[13,15,16,17]` (`comparison`) | Lowercases pre-release labels in `expected_output` (`1.0.0-BETA` → `1.0.0-beta`) while keeping `+AA` uppercase | Preserves input strings when sorting and compares NuGet pre-release labels case-insensitively | [nuget_version_cmp_test.json](https://github.com/package-url/vers-spec/blob/v1.2.1/tests/nuget_version_cmp_test.json) |
| `pypi_range_validate_test.json[2,3,4]` (`validate`) | Accepts duplicate versions (`>=0.0.1\|>=0.0.1`), consecutive same-direction bounds (`>0.0.0\|>=0.0.1`, `<0.0.5\|<=0.0.6`), and equality followed by an upper bound (`0.0.2\|<0.0.3`, `0.0.4\|<0.0.5`) | Rejects those ranges with `VersError` per Clause 5.4 | [Clause 5.4](https://github.com/package-url/vers-spec/blob/v1.2.1/docs/standard/Clause-5-VERS-Specification.md) |

## How to update by hand

1. Clone the new tag from vers-spec, for example:

   ```bash
   git clone --depth 1 --branch vX.Y.Z https://github.com/package-url/vers-spec.git /tmp/vers-spec
   ```

2. Replace the vendored suite and license (do not edit file contents afterwards):

   ```bash
   rm -rf tests/vers/fixtures
   mkdir -p tests/vers/fixtures
   cp -R /tmp/vers-spec/tests/. tests/vers/fixtures/
   cp /tmp/vers-spec/LICENSE tests/vers/fixtures/LICENSE
   ```

3. Update the pinned version, commit SHA, and GitHub URLs in this README.

4. Run `npm run check` and commit the result.
