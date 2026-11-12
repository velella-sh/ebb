# Package Size and Budget

Ebb is designed to be lightweight, fast to install, and dependency-free.

## Current Numbers

- **Packed Tarball Size:** ~268 KB
- **Unpacked Size:** ~2.49 MB
- **Size Budget:** 500 KB (packed tarball)

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
