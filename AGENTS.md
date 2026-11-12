# Working on Ebb

Ebb is an open dataset of software lifecycle rules plus a small TypeScript reader. Read `CONTRIBUTING.md` and `docs/RULES.md` before changing anything under `registry/`.

## Repository Layout

- `src/`: Core library code (`check.ts`, `check-all.ts`, `rules-for.ts`, `replacement.ts`, `purl.ts`, `vers/`).
- `registry/`: Canonical lifecycle rules organized by ecosystem JSON files (`registry/<ecosystem>.json`).
- `schemas/`: JSON schemas for registry, rules, data bundles, and API results.
- `tools/`: Development, linting, benchmarking, and release utilities.
- `tests/`: Automated test suite (unit, property, conformance, and consumer contracts).
- `docs/`: Technical documentation, decision records, and API reference.

## Commands

```bash
npm ci              # Install dependencies
npm run check       # Format check and full test suite
npm run lint:rules  # Validate registry rules against schema and source requirements
npm run api:check   # Validate public TypeScript API surface with API Extractor
npm run size        # Verify packed tarball size stays within budget
npm run bench       # Run performance benchmarks
```

## Review Rules

- A rule needs an authoritative source (vendor announcement, release schedule, registry flag). Blog posts and forum answers are not sources.
- If the source is vague about versions, event, or date, say so and stop. Do not guess.
- Update `sources[].accessedAt` and `provenance.reviewedAt` on every change. Do not set `provenance.reviewer` to anyone who has not reviewed it.
- Add cases in `cases/<ecosystem>.json`: one version the rule matches, one it does not.
- Never rename a rule `id`.

## The "Do Not" List

- **One issue = one pull request:** Do not bundle multiple unrelated features or bug fixes into a single PR.
- **No unrelated edits:** Keep diffs focused exclusively on the claimed issue. Do not reformat untouched files.
- **No new runtime dependencies:** The core library is strictly zero-dependency (`dependencies: {}`).
- **Do not edit vendored fixtures:** Upstream test fixtures (e.g. `tests/purl/fixtures/`) must remain byte-for-byte identical to upstream.
- **Do not use network in core library:** `src/` must remain completely offline. Network access is reserved solely for CLI updates and tool importers.
