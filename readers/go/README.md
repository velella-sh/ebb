# Ebb Go reader module

The module path is `github.com/velella-sh/ebb/readers/go` and the package name is `ebb`. The sole dependency is the pinned upstream Package URL parser, `packageurl-go`.

- `PURLIdentity` parses a PURL and keeps its canonical type, namespace and name. Conformance tests use the repository's upstream vectors for generic, npm, Go, PyPI and GitHub PURLs.
- `VersContains` compares `semver`, `npm`, `golang` and `pep440` (`pypi` in the upstream vectors). Check the error before interpreting the Boolean result. `ErrUnsupportedScheme` identifies a scheme this reader cannot evaluate.
- `LoadRegistry` reads a v2 registry envelope from an `io.Reader`. `LoadBundle` reads a v1 or v2 bundle and checks its exact SHA-256, the SHA-256 and size of each file, and the manifest's content address. Both cap input at 16 MiB. Rules remain JSON for caller-level validation and matching.

## Check a component

Pass `WithRegistry` or `WithBundle` to `Check` to evaluate caller-supplied data. The snapshot produces `affected`, `not-affected` or `unknown`. Read the error before using the result. A matching rule retains the event, any announced date, and its sources. An empty deadline remains unknown. The checker keeps the event from the stored snapshot.

Optional `WithPredictions` input follows the draft prediction profile. A result keeps the estimated date, bounds and confidence in its separate `Predictions` field. An estimate never changes the coverage result, and a dated end-of-life rule supersedes it. Current published registries supply no prediction field. [Draft prediction profile](https://velella.sh/ebb/spec/1.0/predictions/)

For repeated calls, create one `NewChecker` and reuse it across components. The [CycloneDX example](examples/sbom/README.md) shows this with a checked-in SBOM.

## Verify a release before loading

Use the signed-release instructions to verify the downloaded bundle and release log with `cosign verify-blob`, the release workflow's GitHub identity and its OIDC issuer. Pass the verified log's `bundleSha256` for that version to `LoadBundle`. Scanners supply their own readers and choose where to obtain the bytes. [Ebb release verification](https://velella.sh/ebb/verify/)

## Develop

The minimum is Go 1.26. The [Go release policy](https://go.dev/doc/devel/release#policy) supports Go 1.26 and 1.27 as of 28 November 2026. Run the checks from this directory with the repository's fixtures present.

```bash
go build ./...
go test ./...
go vet ./...
```

Go module releases use repository tags of the form `readers/go/vX.Y.Z`, with the module directory before the version. See the [Go modules reference](https://go.dev/ref/mod#vcs-version).
