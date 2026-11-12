# Contributing to Ebb

Thank you for helping keep the almanac accurate. Most contributions are one of these:

- **A new rule**, meaning a deprecation, end of support, end of life, or removal that an authoritative source announces. Follow [docs/RULES.md](docs/RULES.md).
- **A correction** to an existing rule: a wrong version range, a moved source, a date that changed. Update the rule, its `sources[].accessedAt`, and its `provenance.reviewedAt`.
- **An importer** that drafts rules from a machine-readable source. See [docs/IMPORTERS.md](docs/IMPORTERS.md).
- **Library code**, such as purl and VERS handling or data loading and verification.

## Before you open a pull request

```bash
npm ci
npm run check        # formatting and every test
npm run lint:rules   # every registry and every case
```

A rule change also needs cases in `cases/<ecosystem>.json`: one version the rule must match and one it must not.

## What a rule needs

- An authoritative source, such as the vendor's own announcement, release schedule, or registry flag. A blog post or a forum answer is not one.
- The exact versions the source covers, and the event in the source's own words.
- Your GitHub username as `provenance.reviewer`.

If the source is vague about versions, the event, or a date, open an issue instead of guessing.

## Code path

Contributors and autonomous agents working on library or tool code should follow [AGENTS.md](AGENTS.md):
1. Claim an open issue labeled `type:task`.
2. Branch from `main` with a descriptive name (e.g. `feat/issue-number-description`).
3. Run `npm run check`, `npm run api:check`, `npm run lint:rules`, and `npm run size`.
4. Open a pull request using the standard pull request template.

## Ground rules

- Library code never uses the network, except `updateData()` when a caller asks for it. Tools and importers may.
- No new runtime dependency without a reason in the pull request.
- One change per pull request.

By contributing you agree that your code is licensed under MIT and your data under CC BY 4.0, as the rest of the repository is.
