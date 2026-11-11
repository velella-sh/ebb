# VERS test suite

Official [VERS (vers-spec)](https://github.com/package-url/vers-spec) conformance vectors, vendored for Ebb.

## Source

- Upstream: https://github.com/package-url/vers-spec
- Pinned version: `v1.2.1` (commit `76c729180ce3ffb24b2e9f90e34585150fe0ffcf`)
- Suite tree: https://github.com/package-url/vers-spec/tree/v1.2.1/tests
- License (MIT): https://github.com/package-url/vers-spec/blob/v1.2.1/LICENSE

`fixtures/*.json` are copied unchanged from that tag's `tests/` directory. `fixtures/LICENSE` is the upstream MIT license from the same tag.

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
