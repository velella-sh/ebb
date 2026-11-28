# Ebb Go reader module

The module path is `github.com/velella-sh/ebb/readers/go` and the package name is `ebb`. This scaffold reserves the package for the Go lifecycle data reader. It has no dependencies.

The minimum is Go 1.26. The [Go release policy](https://go.dev/doc/devel/release#policy) supports Go 1.26 and 1.27 as of 28 November 2026. Run both checks from this directory.

```bash
go build ./...
go vet ./...
```

Go module releases use repository tags of the form `readers/go/vX.Y.Z`, with the module directory before the version. See the [Go modules reference](https://go.dev/ref/mod#vcs-version).
