---
title: "Lifecycle data changelog"
description: "History of additions, deprecation changes, and updates in the Ebb lifecycle dataset."
layout: doc
permalink: /data-changelog/
---

Track additions, field updates, deprecation advances, and rule removals across all 25 supported ecosystems in the Ebb lifecycle dataset.

## Following data changes

Follow the [signed lifecycle data releases](https://velella.sh/ebb/data-releases/) in [RSS](https://velella.sh/ebb/feed.xml) or [Atom](https://velella.sh/ebb/atom.xml). The [original Atom address](https://velella.sh/ebb/data-changelog.atom) serves the same feed.

Each entry links to the canonical release page and its verification assets. Run `ebb release-log --json` to inspect the authenticated log locally. The changelog notes below describe repository data changes.

### Tamper-evident protection

Every release extends a signed hash chain (`release-log.jsonl`). Each entry commits to the cryptographic hash of the entry before it. During `ebb update`, Ebb verifies that the downloaded log is intact and extends the local log. If any past release was altered, removed, or reordered, update aborts immediately and leaves active cached data untouched.

---

## [0.4.0] - 2026-11-14

### Summary
- **Added:** 30 rules
- **Changed:** 12 rules
- **Removed:** 0 rules
- **Total Active:** 782 rules

### npm
- **Added** [`npm.package.left-pad.deprecated`](https://velella.sh/ebb/api/v1/rules/npm.package.left-pad.deprecated.json) (`pkg:npm/left-pad`): Left-pad package unpublish & deprecation notice (deprecated, vers: `*`) by @arminazimi in [#360](https://github.com/velella-sh/ebb/pull/360)
- **Added** [`npm.package.node-sass.deprecated`](https://velella.sh/ebb/api/v1/rules/npm.package.node-sass.deprecated.json) (`pkg:npm/node-sass`): LibSass and Node Sass officially deprecated (deprecated, vers: `*`) by @arminazimi in [#360](https://github.com/velella-sh/ebb/pull/360)
- **Changed** [`npm.package.request.deprecated`](https://velella.sh/ebb/api/v1/rules/npm.package.request.deprecated.json) (`pkg:npm/request`): Updated replacement recommendation and source citation by @arminazimi in [#360](https://github.com/velella-sh/ebb/pull/360)

### nodejs
- **Added** [`nodejs.runtime.eol-24`](https://velella.sh/ebb/api/v1/rules/nodejs.runtime.eol-24.json) (`pkg:generic/nodejs`): Node.js 24 LTS lifecycle schedule (scheduled, vers: `>=24.0.0|<25.0.0`, deadline: 2028-04-30) by @arminazimi in [#355](https://github.com/velella-sh/ebb/pull/355)
- **Changed** [`nodejs.runtime.eol-22`](https://velella.sh/ebb/api/v1/rules/nodejs.runtime.eol-22.json) (`pkg:generic/nodejs`): Re-verified against official Node.js Release WG schedule by @arminazimi in [#356](https://github.com/velella-sh/ebb/pull/356)

### python
- **Added** [`python.runtime.eol-3.13`](https://velella.sh/ebb/api/v1/rules/python.runtime.eol-3.13.json) (`pkg:generic/python`): Python 3.13 maintenance release schedule (scheduled, vers: `>=3.13.0|<3.14.0`, deadline: 2029-10-31) by @arminazimi in [#355](https://github.com/velella-sh/ebb/pull/355)

---

## [0.3.0] - 2026-11-13

### Summary
- **Added:** 45 rules
- **Changed:** 18 rules
- **Removed:** 0 rules
- **Total Active:** 752 rules

### cargo
- **Added** [`cargo.crate.lazy_static.deprecated`](https://velella.sh/ebb/api/v1/rules/cargo.crate.lazy_static.deprecated.json) (`pkg:cargo/lazy_static`): Superseded by standard library OnceLock (deprecated, vers: `*`) by @arminazimi in [#340](https://github.com/velella-sh/ebb/pull/340)

### golang
- **Added** [`golang.package.io-ioutil.deprecated`](https://velella.sh/ebb/api/v1/rules/golang.package.io-ioutil.deprecated.json) (`pkg:golang/io/ioutil`): Deprecated in Go 1.16 in favor of io and os packages (deprecated, vers: `*`) by @arminazimi in [#342](https://github.com/velella-sh/ebb/pull/342)

### maven
- **Added** [`maven.artifact.log4j-1.2.eol`](https://velella.sh/ebb/api/v1/rules/maven.artifact.log4j-1.2.eol.json) (`pkg:maven/log4j/log4j`): Apache Log4j 1.x reached end of life (end-of-life, vers: `<=1.2.17`, deadline: 2015-08-05) by @arminazimi in [#345](https://github.com/velella-sh/ebb/pull/345)

---

## [0.2.0] - 2026-11-11

### Summary
- **Added:** 652 rules
- **Changed:** 0 rules
- **Removed:** 0 rules
- **Total Active:** 707 rules

### Multi-Ecosystem Launch
- Expanded coverage to 25 ecosystems: Android SDKs, C++, Container images, Dart, Databases, Deno, .NET, Elixir, GitHub Actions, Go, Java/Maven, Kubernetes, Node.js, npm, OSV vulnerabilities, PHP/Packagist, Python/PyPI, Ruby/Gems, Rust/Cargo, Scala, Serverless, Shell, Swift, and Terraform providers.
- 100% authoritative evidence backing with verified HTTPS source citations.
- Introduced Static JSON API (`api/v1/`) with prefix search index.

---

## [0.1.0] - 2026-10-15

### Summary
- **Added:** 100 rules
- **Total Active:** 100 rules

### Initial Release
- Initial release of Ebb, the open almanac of software end-of-life and deprecation.
- Core lifecycle rules for Node.js, Python runtime lines, and widely used npm/PyPI dependencies.
- Strict PURL and VERS range specification adherence.
