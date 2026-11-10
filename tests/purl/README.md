# PURL test suite

Official [Package-URL (purl-spec)](https://github.com/package-url/purl-spec) conformance vectors, vendored for Ebb.

## Source

- Upstream: https://github.com/package-url/purl-spec
- Pinned version: `v1.1.0`
- Suite tree: https://github.com/package-url/purl-spec/tree/v1.1.0/tests
- License (MIT): https://github.com/package-url/purl-spec/blob/v1.1.0/LICENSE

`fixtures/spec/` and `fixtures/types/` are copied unchanged from that tag's `tests/` directory. `fixtures/LICENSE` is the upstream MIT license from the same tag.

## Upstream inconsistencies

`upstream-inconsistencies.json` lists fixture cases that contradict other cases or ECMA-427 "shall" rules (shrink-only). Each entry names the case, gives a one-line reason, and links the upstream issue. The suite runner requires that those cases still disagree with the fixture and that Ebb's documented alternative holds; they still count toward `purl-spec pass rate: N/M` when they do.

| Case | Fixture expects | Ebb does | Upstream |
|---|---|---|---|
| `types/maven-test.json[13]` (required parse) | Success for mixed-case qualifier key `repositorY_url` (key lowercased in the expected components) | Strict `parsePurl` rejects the mixed-case key (documented alternative in the suite runner) | [purl-spec#1027](https://github.com/package-url/purl-spec/issues/1027) |
| `types/gem-test.json[1]` (required parse) | Failure for `?Platform=java` (qualifier key not lowercase) | Rejects with a clear qualifier-key error (same outcome as the fixture) | [purl-spec#942](https://github.com/package-url/purl-spec/issues/942) — how-to-parse still describes lowercasing the key, so this required-failure case disagrees with that written procedure |
| `types/rpm-test.json[1]` (required parse) | Failure for `?Arch=…&Distro=…` (qualifier keys not lowercase) | Rejects with a clear qualifier-key error (same outcome as the fixture) | [purl-spec#942](https://github.com/package-url/purl-spec/issues/942) — same how-to-parse tension as gem-test[1] |

Only the maven row is listed in `upstream-inconsistencies.json` (Ebb and the fixture disagree; the alternative keeps the pass-rate line at full). gem-test[1] and rpm-test[1] already match Ebb; they stay out of that file and are documented here because they conflict with the still-lenient how-to-parse text.

## How to update by hand

1. Clone the new tag from purl-spec, for example:

   ```bash
   git clone --depth 1 --branch vX.Y.Z https://github.com/package-url/purl-spec.git /tmp/purl-spec
   ```

2. Replace the vendored suite and license (do not edit file contents afterwards):

   ```bash
   rm -rf tests/purl/fixtures/spec tests/purl/fixtures/types
   cp -R /tmp/purl-spec/tests/spec tests/purl/fixtures/spec
   cp -R /tmp/purl-spec/tests/types tests/purl/fixtures/types
   cp /tmp/purl-spec/LICENSE tests/purl/fixtures/LICENSE
   ```

3. Update the pinned version in this README (`vX.Y.Z` and the two GitHub tree/blob URLs above).

4. Run `npm run check` and commit the result.
