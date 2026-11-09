# PURL test suite

Official [Package-URL (purl-spec)](https://github.com/package-url/purl-spec) conformance vectors, vendored for Ebb.

## Source

- Upstream: https://github.com/package-url/purl-spec
- Pinned version: `v1.1.0`
- Suite tree: https://github.com/package-url/purl-spec/tree/v1.1.0/tests
- License (MIT): https://github.com/package-url/purl-spec/blob/v1.1.0/LICENSE

`fixtures/spec/` and `fixtures/types/` are copied unchanged from that tag's `tests/` directory. `fixtures/LICENSE` is the upstream MIT license from the same tag.

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
