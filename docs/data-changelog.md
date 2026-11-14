---
title: "Lifecycle data changelog"
description: "History of additions, deprecation changes, and updates in the Ebb lifecycle dataset."
layout: doc
permalink: /data-changelog/
---

Track additions, field updates, deprecation advances, and rule removals across all 25 supported ecosystems in the Ebb lifecycle dataset.

An Atom feed of these data updates is published at [`/data-changelog.atom`](/data-changelog.atom).

---

## [0.4.0] - 2026-11-14

### Summary
- **Added:** 30 rules
- **Changed:** 12 rules
- **Removed:** 0 rules
- **Total Active:** 782 rules

### npm
- **Added** `npm.package.left-pad.deprecated` (`pkg:npm/left-pad`): Left-pad package unpublish & deprecation notice (deprecated, vers: `*`) by @arminazimi in [#360](https://github.com/velella-sh/ebb/pull/360)
- **Added** `npm.package.node-sass.deprecated` (`pkg:npm/node-sass`): LibSass and Node Sass officially deprecated (deprecated, vers: `*`) by @arminazimi in [#360](https://github.com/velella-sh/ebb/pull/360)
- **Changed** `npm.package.request.deprecated` (`pkg:npm/request`): Updated replacement recommendation and source citation by @arminazimi in [#360](https://github.com/velella-sh/ebb/pull/360)

### nodejs
- **Added** `nodejs.runtime.eol-24` (`pkg:generic/nodejs`): Node.js 24 LTS lifecycle schedule (scheduled, vers: `>=24.0.0|<25.0.0`, deadline: 2028-04-30) by @arminazimi in [#355](https://github.com/velella-sh/ebb/pull/355)
- **Changed** `nodejs.runtime.eol-22` (`pkg:generic/nodejs`): Re-verified against official Node.js Release WG schedule by @arminazimi in [#356](https://github.com/velella-sh/ebb/pull/356)

### python
- **Added** `python.runtime.eol-3.13` (`pkg:generic/python`): Python 3.13 maintenance release schedule (scheduled, vers: `>=3.13.0|<3.14.0`, deadline: 2029-10-31) by @arminazimi in [#355](https://github.com/velella-sh/ebb/pull/355)

---

## [0.3.0] - 2026-11-13

### Summary
- **Added:** 45 rules
- **Changed:** 18 rules
- **Removed:** 0 rules
- **Total Active:** 752 rules

### cargo
- **Added** `cargo.crate.lazy_static.deprecated` (`pkg:cargo/lazy_static`): Superseded by standard library OnceLock (deprecated, vers: `*`) by @arminazimi in [#340](https://github.com/velella-sh/ebb/pull/340)

### golang
- **Added** `golang.package.io-ioutil.deprecated` (`pkg:golang/io/ioutil`): Deprecated in Go 1.16 in favor of io and os packages (deprecated, vers: `*`) by @arminazimi in [#342](https://github.com/velella-sh/ebb/pull/342)

### maven
- **Added** `maven.artifact.log4j-1.2.eol` (`pkg:maven/log4j/log4j`): Apache Log4j 1.x reached end of life (end-of-life, vers: `<=1.2.17`, deadline: 2015-08-05) by @arminazimi in [#345](https://github.com/velella-sh/ebb/pull/345)

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
