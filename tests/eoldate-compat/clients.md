# endoflife.date client verification

Tested on 2026-11-27 (UTC) against files built from the Ebb checkout and served
locally. Both clients were used unmodified.

```sh
output=$(mktemp -d)
npm run build:static-api -- --out "$output/api/v1" --eol-compat-out "$output/api/eol-compat/v1"
python3 -m http.server 38161 --bind 127.0.0.1 --directory "$output"
```

## Renovate 45.3.2 (Node.js 24.22.3)

Create a local Git fixture with `lifecycle.txt` containing `nodejs 18` and this
`renovate.json`. Commit both fixture files before running the lookup.

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "managerFilePatterns": ["/^lifecycle[.]txt$/"],
      "matchStrings": ["(?<depName>nodejs) (?<currentValue>[0-9]+)"],
      "datasourceTemplate": "endoflife-date"
    }
  ],
  "packageRules": [
    {
      "matchDatasources": ["endoflife-date"],
      "registryUrls": ["http://127.0.0.1:38161/api/eol-compat/v1/renovate"]
    }
  ]
}
```

```sh
LOG_LEVEL=debug npx --yes --package=renovate@45.3.2 renovate --platform=local --dry-run=lookup
```

The datasource fetched `renovate/nodejs.json`, recognized the dependency at
cycle 18, and reported a candidate at cycle 27. The dry run made no repository
changes. The built-in datasource expects a legacy array, so pointing it at
`/api/eol-compat/v1/products` produces a parsing error and no lookup result.
An upgrade reported by Renovate here verifies that it accepted the response.
Use an upstream package registry to confirm release availability.

## Go v1 client

Tested `github.com/shyim/go-endoflife-api` at commit
[`cef0497bf1d7`](https://github.com/shyim/go-endoflife-api/commit/cef0497bf1d73478576ce0c837e15776b0e868f5)
with Go 1.27.4. In a temporary module, save the following as `main.go`.

```go
package main

import (
    "context"
    "fmt"
    "log"

    eol "github.com/shyim/go-endoflife-api"
)

func main() {
    client := eol.NewClient(eol.WithBaseURL("http://127.0.0.1:38161/api/eol-compat/v1"))
    ctx := context.Background()
    for _, product := range []string{"nodejs", "python"} {
        response, err := client.Product(ctx, product)
        if err != nil {
            log.Fatal(err)
        }
        known := 0
        for _, release := range response.Result.Releases {
            if release.EolFrom != nil && release.Custom["ebbRuleUrl"] != nil {
                known++
            }
        }
        if response.Result.Name != product || known == 0 {
            log.Fatalf("unexpected response for %s", product)
        }
        fmt.Printf("%s: %d releases, %d with EOL dates and rule URLs\n", product, len(response.Result.Releases), known)
    }
    if _, err := client.Product(ctx, "ebb-unknown-compat-product"); !eol.IsNotFound(err) {
        log.Fatalf("expected HTTP 404, got %v", err)
    }
    fmt.Println("unknown product: HTTP 404")
}
```

```sh
go mod init example.com/ebb-eol-compat-smoke
go get github.com/shyim/go-endoflife-api@cef0497bf1d73478576ce0c837e15776b0e868f5
go run .
```

Node.js returned 10 releases and Python returned 6. All had EOL dates and Ebb
rule URLs. The unknown product produced HTTP 404. The client's `Product` call
uses the extensionless product alias. Its other methods may require routes
outside Ebb's published product endpoints.
