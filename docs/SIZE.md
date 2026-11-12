# Package Size and Budget

Ebb is designed to be lightweight, fast to install, and dependency-free.

## Current Numbers

- **Packed Tarball Size:** ~268 KB
- **Unpacked Size:** ~2.49 MB
- **Size Budget:** 500 KB (packed tarball)

## Size by Ecosystem Subpath

Consumers using subpaths like `@velella/ebb/data/<ecosystem>` only bundle or load rules for that specific ecosystem:

| Ecosystem | Rules | Module (Unpacked) | Gzipped |
| :--- | :--- | :--- | :--- |
| `@velella/ebb/data/android` | 6 | 13.2 KB | 1.9 KB |
| `@velella/ebb/data/ci-images` | 5 | 10.1 KB | 1.6 KB |
| `@velella/ebb/data/container` | 35 | 57.0 KB | 6.8 KB |
| `@velella/ebb/data/cpp` | 5 | 8.4 KB | 2.0 KB |
| `@velella/ebb/data/dart` | 15 | 34.6 KB | 2.2 KB |
| `@velella/ebb/data/database` | 48 | 155.3 KB | 9.7 KB |
| `@velella/ebb/data/deno` | 4 | 3.7 KB | 0.8 KB |
| `@velella/ebb/data/dotnet` | 16 | 35.5 KB | 3.2 KB |
| `@velella/ebb/data/elixir` | 5 | 9.3 KB | 1.7 KB |
| `@velella/ebb/data/github-actions` | 29 | 45.1 KB | 4.1 KB |
| `@velella/ebb/data/go` | 12 | 21.2 KB | 2.4 KB |
| `@velella/ebb/data/java` | 11 | 23.3 KB | 3.5 KB |
| `@velella/ebb/data/kubernetes` | 80 | 196.8 KB | 10.7 KB |
| `@velella/ebb/data/nodejs` | 80 | 103.0 KB | 8.2 KB |
| `@velella/ebb/data/npm` | 82 | 143.6 KB | 20.7 KB |
| `@velella/ebb/data/osv` | 2 | 1.5 KB | 0.5 KB |
| `@velella/ebb/data/php` | 14 | 27.9 KB | 3.3 KB |
| `@velella/ebb/data/python` | 129 | 187.1 KB | 17.0 KB |
| `@velella/ebb/data/ruby` | 15 | 26.4 KB | 2.7 KB |
| `@velella/ebb/data/rust` | 5 | 6.9 KB | 2.0 KB |
| `@velella/ebb/data/scala` | 3 | 5.4 KB | 1.5 KB |
| `@velella/ebb/data/serverless` | 138 | 267.2 KB | 10.2 KB |
| `@velella/ebb/data/shell` | 7 | 21.0 KB | 1.9 KB |
| `@velella/ebb/data/swift` | 3 | 5.5 KB | 1.5 KB |
| `@velella/ebb/data/terraform` | 33 | 96.1 KB | 7.1 KB |

## How Size is Measured

Package size is measured automatically using `npm pack --dry-run --json` via:

```bash
npm run size
```

The tool calculates:
1. Total packed tarball size.
2. Total unpacked size.
3. Top 10 largest files included in the package.
4. Gzipped size of the core registry data.

In CI, every pull request runs this check (`.github/workflows/size.yml`) and fails if the packed size exceeds the defined budget in `package.json`.

## Raising the Budget

The budget exists to prevent accidental packaging bloat (e.g. shipping build artifacts, tests, or unminified vendor files).

To raise the budget:
1. Open a discussion or decision record explaining why the size increase is necessary (e.g. addition of new ecosystem data rules).
2. Update `"sizeBudget"` in `package.json` under the `"ebb"` key.
3. Update this document and the size line in `README.md`.
