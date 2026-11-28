---
title: Lifecycle coverage inventories
description: Dated lifecycle evidence, review batches and support-policy gaps for selected components.
layout: doc
permalink: /coverage-inventories/
---

Evidence checked on **2026-11-28 UTC**. Coverage counts compare [checkout 50a805e](https://github.com/velella-sh/ebb/tree/50a805e093e0eeb76727a8e5da9d6877c39c22cb/registry) (862 rules) with the [signed 2026.11.11 snapshot](https://github.com/velella-sh/ebb/releases/tag/data-v2026.11.11) (782 rules, SHA-256 `09f3f558e6708b6f7ec8fd4df0494601d4c1c99eb50526f7db20591a3852f3a4`). Each count is the number of rules for that exact PURL across all registries, shown as **checkout / signed**. A zero records an evidence coverage gap. The proposed ranges and rule IDs designate work for human review in later PRs.

## Databases

Prioritize the established PostgreSQL engine and provider identities so that a community retirement cannot accidentally be applied to customer workloads on a managed service. Dates below retain the vendor's stated phase and precision.

| Product, provider or edition | Ebb identity | Rules | Verified evidence and remaining gaps |
| --- | --- | ---: | --- |
| PostgreSQL Community | `pkg:generic/postgresql` | 5 / 5 | Majors 10–14 have rows. The community lists 14 as unsupported after its final release on 2026-11-12, and the cutoff for 15 as 2027-11-11. The 14 row still says scheduled, and 15 has no row. [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/) |
| Amazon RDS for PostgreSQL | `pkg:generic/aws-rds/postgres` | 6 / 6 | Existing coverage spans 9.6 and 10–14. RDS 15 standard support ends 2028-02-29. Its paid Extended Support tier ends 2031-02-28. Both provider boundaries are separate gaps. [RDS release calendar](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-release-calendar.html) |
| Amazon Aurora PostgreSQL | `pkg:generic/aws-aurora/postgresql` | 4 / 4 | Existing rows span 11–14. The Aurora 15 calendar gives a major-line standard boundary of 2028-02-29 and an Extended Support end of 2031-02-28. It also records individual minor cutoffs and currently names 15.10 for the extended tier. An Aurora rule needs its own major or minor scope. [Aurora PostgreSQL release calendar](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/aurorapostgresql-release-calendar.html) |
| Azure Database for PostgreSQL Flexible Server | `pkg:generic/azure-database-postgresql` | 1 / 1 | The existing row covers the 11–13 standard-support boundary. Azure lists 2027-01-31 for version 14 standard support. Extended Support has its own terms and needs a separate entry. [Azure Flexible Server version policy](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-version-policy#support-policy) |
| Google Cloud SQL for PostgreSQL | `pkg:generic/google-cloud-sql-postgresql` | 2 / 2 | Existing rows cover transitions for 9.6–13. The provider lists 2027-02-01 as the Extended Support start for 14 and 2030-02-01 separately as its deprecation date. Both 14 boundaries are gaps. [Cloud SQL version policies](https://docs.cloud.google.com/sql/docs/postgres/db-versions) |
| MySQL Server | `pkg:generic/mysql` | 2 / 2 | Existing entries cover 5.7 and 8.0. Review Oracle's LTS track, support phases and edition scope before translating an 8.4 boundary into a shared Community identity. [MySQL release model](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html) |
| MariaDB Server Community | `pkg:generic/mariadb` (proposed) | 0 / 0 | The Foundation lists community maintenance separately from Enterprise and Extended support. Settle the new identity and use only the Community column for a Community rule. [MariaDB Foundation maintenance policy](https://mariadb.org/about/#maintenance-policy) |

### First database batch

Two community PostgreSQL rows fit [the first database rule batch](https://github.com/velella-sh/ebb/issues/1030) without adding a provider or edition identifier.

| Candidate rule ID | Affected scope | Source boundary | Positive / negative case versions |
| --- | --- | --- | --- |
| `database.postgresql.end-of-life-14` (existing ID) | `vers:semver/>=14.0.0\|<15.0.0` | Community end of life on **2026-11-12**. Review promotion from scheduled to realized. [PostgreSQL policy](https://www.postgresql.org/support/versioning/) | `14.25` / `15.20` |
| `database.postgresql.end-of-life-15` (proposed ID) | `vers:semver/>=15.0.0\|<16.0.0` | Scheduled community end of life on **2027-11-11**. [PostgreSQL policy](https://www.postgresql.org/support/versioning/) | `15.20` / `16.16` |

Provider transitions remain a separate batch. Check how a future standard-support boundary with continuing paid coverage is represented before adding one.

## OS distributions

Use the established host identities and `semver` normalization in the existing `container` registry for the first batch. The registry already distinguishes host PURLs from image PURLs such as `pkg:docker/library/alpine`. Keeping new host rows next to those existing rules avoids a separate registry and a migration of stable IDs. Revisit the file decision if future OS coverage needs architecture, repository or subscription qualifiers the current host identities cannot express.

| Distribution and scope | Existing host identity | Rules | Verified evidence and remaining gaps |
| --- | --- | ---: | --- |
| Alpine release branches | `pkg:generic/alpine` | 1 / 1 | The host rule covers 3.20 and older. The 3.21 branch's standard `main` support ended **2026-11-01**. Alpine documents a distinct, generally shorter `community` window and possible fixes on request. An existing Docker image row for 3.21 covers a separate identity. [Alpine release branches](https://alpinelinux.org/releases/) |
| Debian 12 bookworm | `pkg:generic/debian` | 3 / 1 | Existing host entries concern Debian 11 and older. Debian records full support through **2026-07-11** and LTS through **2028-06-30**, with a smaller set of supported architectures during LTS. The first boundary is suitable for the host file. Architecture and package scope needs to be captured before generalizing the LTS endpoint. [Debian 12 release information](https://www.debian.org/releases/bookworm/) |
| Amazon Linux 2023 | `pkg:generic/amzn` | 1 / 1 | The existing host row concerns Amazon Linux 2 and earlier. AWS lists **2027-06-30** as the end of AL2023 standard support and **2029-06-30** as the end of maintenance. Verify how AL2023's calendar-version strings map to the shared identity and VERS range before adding its two phases. [Amazon Linux 2023 release cadence](https://docs.aws.amazon.com/linux/al2023/ug/release-cadence.html) |
| Ubuntu 22.04 LTS host | `pkg:generic/ubuntu` | 3 / 1 | Existing host data has older-line endpoints and newer checkout extended-support rows. Canonical lists standard security maintenance through **May 2027**, expanded security maintenance through **May 2032**, and the Legacy add-on through **May 2037**. These are month-level values under distinct tiers. Check entitlement and date encoding before proposing a standard host boundary. [Canonical release cycle](https://ubuntu.com/about/release-cycle) |
| Red Hat Enterprise Linux | `pkg:generic/rhel` | 2 / 1 | Existing host rows cover RHEL 7 and earlier and a checkout 7.x extended-support record. The provider describes an Extended Life Cycle Program for the last minor releases starting with RHEL 8.10 on **2029-06-01**. Purchase, minor-release and maintenance scope must remain separate. [Red Hat lifecycle policy](https://access.redhat.com/support/policy/updates/errata) |

### First OS batch

The first two host rows for [the OS rule batch](https://github.com/velella-sh/ebb/issues/1035) can use day-precision sources and the current identifiers.

| Proposed rule ID | Affected scope | Source boundary | Positive / negative case versions |
| --- | --- | --- | --- |
| `container.host-alpine.end-of-support-3.21` | `vers:semver/>=3.21.0\|<3.22.0` | Alpine 3.21 `main` branch support ended **2026-11-01**. [Alpine release branches](https://alpinelinux.org/releases/) | `3.21.10` / `3.22.0` |
| `container.host-debian.end-of-active-support-12` | `vers:semver/>=12.0.0\|<13.0.0` | Full support ended **2026-07-11**. Keep the 2028 limited LTS boundary separate. [Debian 12 release information](https://www.debian.org/releases/bookworm/) | `12.15` / `13.0` |

## PyPI packages

The [30-day download snapshot](https://raw.githubusercontent.com/hugovk/top-pypi-packages/29c0d4c38c28c0e6b99e73fa09cb91a2323ca51b/top-pypi-packages-30-days.min.json) was updated at **2026-11-01 06:41:05 UTC** and has SHA-256 `3e958a64ebe1de0b6a4ab4c6b465d481f350fd1dfa926c639add36eb34dabc1e`. Downloads are a prioritization signal. Lifecycle facts come from maintainers and PyPI. The candidate list samples high-download projects plus Django for an explicit, dated gap in a covered identity.

| Download rank | Package identity | Rules | Primary evidence and review gap |
| ---: | --- | ---: | --- |
| 1 | `pkg:pypi/boto3` | 0 / 0 | AWS lists Boto3 1.x as generally available. Python runtime compatibility and SDK lifecycle are separate. A retirement boundary for the Boto3 line was not identified in the matrix. [AWS SDK lifecycle matrix](https://docs.aws.amazon.com/sdkref/latest/guide/version-support-matrix.html) |
| 6 | `pkg:pypi/urllib3` | 0 / 0 | Maintainers say the 1.26.x stream is no longer maintained and give no cutoff day. This supports an undated support-end row with a range specific to that stream. [urllib3 migration guide](https://urllib3.readthedocs.io/en/stable/v2-migration-guide.html#sunsetting-urllib3-1-26-x) |
| 8 | `pkg:pypi/requests` | 0 / 0 | The project's policy describes major, minor and hotfix releases. A version-line retirement cutoff requires additional evidence. [Requests release process](https://requests.readthedocs.io/en/latest/community/release-process/) |
| 18 | `pkg:pypi/pydantic` | 0 / 0 | V1 active development has ended. Critical and security fixes continue until V3 under the maintainer policy. The remaining phase has a release trigger and no calendar day in the checked policy. [Pydantic version policy](https://pydantic.dev/docs/validation/latest/get-started/version-policy/#pydantic-v1) |
| 21 | `pkg:pypi/numpy` | 0 / 0 | NEP 29 documents downstream Python and NumPy compatibility and points to SPEC 0. A maintainer retirement boundary for a particular NumPy distribution line needs separate evidence. [NumPy NEP 29](https://numpy.org/neps/nep-0029-deprecation_policy.html) |
| 22 | `pkg:pypi/botocore` | 0 / 0 | AWS lists Botocore 1.x as generally available separately from Boto3. A Python-version compatibility cutoff is a different event. [AWS SDK lifecycle matrix](https://docs.aws.amazon.com/sdkref/latest/guide/version-support-matrix.html) |
| 466 | `pkg:pypi/django` | 20 / 20 | Existing rows record end of life for series through 5.1. The project records the mainstream support end for 6.0 on **2026-08-04** and its extended end at month precision, **April 2027**. Only the exact mainstream date enters the first batch. [Django support schedule](https://www.djangoproject.com/download/#supported-versions) |

### First PyPI batch

Two independent rows fit [the first PyPI rule batch](https://github.com/velella-sh/ebb/issues/1037). Use an absent deadline for the undated event.

| Proposed rule ID | Affected scope | Source boundary | Published positive / negative examples |
| --- | --- | --- | --- |
| `python.package.urllib3.end-of-support-1.26` | `vers:pypi/>=1.26\|<1.27.dev0` | End of support for 1.26.x, **day unspecified**. [Maintainer notice](https://urllib3.readthedocs.io/en/stable/v2-migration-guide.html#sunsetting-urllib3-1-26-x) | [1.26.20](https://pypi.org/project/urllib3/1.26.20/) / [2.0.7](https://pypi.org/project/urllib3/2.0.7/) |
| `python.package.django.end-of-active-support-6.0` | `vers:pypi/>=6.0\|<6.1.dev0` | End of mainstream support on **2026-08-04**. [Django support schedule](https://www.djangoproject.com/download/#supported-versions) | [6.0.10](https://pypi.org/project/Django/6.0.10/) / [6.1.3](https://pypi.org/project/Django/6.1.3/) |

## Maven packages

Evidence and popularity checked on **2026-11-28 UTC**. The Maven and NuGet tables below use [checkout c4ead46](https://github.com/velella-sh/ebb/tree/c4ead4650f3bfddfa196c80f99d56bf5aa8527e9/registry) (862 rules) and the same signed 2026.11.11 snapshot as above (782 rules). Counts use exact PURLs across all registry files, shown as **checkout / signed**. Maven accounts for 27 / 11 rules across five distinct PURLs in each dataset. NuGet accounts for 4 / 4 rules across four distinct PURLs in each. The generic JDK and .NET runtime identities are outside these package counts.

[MvnRepository's ranking](https://mvnrepository.com/popular) and the indexed dependent counts on its artifact pages help prioritize work. They measure indexed usage, which can change between crawls. Apache, JUnit, FasterXML and Spring provide the lifecycle evidence.

| Maven package identity | Popularity signal | Rules | Maintainer evidence and remaining gaps |
| --- | --- | ---: | --- |
| `pkg:maven/junit/junit` | [Rank 7](https://mvnrepository.com/popular) | 0 / 0 | JUnit 4 is in maintenance mode. That statement gives no end-of-support date. [JUnit 4 project](https://junit.org/junit4/index.html) |
| `pkg:maven/org.junit.jupiter/junit-jupiter-api` | [Rank 2](https://mvnrepository.com/popular) | 0 / 0 | The guide documents JUnit Jupiter separately from JUnit Vintage and identifies the deprecated Vintage engine. A retirement boundary for the Jupiter API needs its own announcement. [JUnit guide](https://docs.junit.org/current/user-guide/) |
| `pkg:maven/log4j/log4j` | [19.8K indexed dependents](https://mvnrepository.com/artifact/log4j/log4j) | 0 / 0 | Apache records end of life for Log4j 1.x on **2015-08-05**. Maven Central publishes 1.x under the legacy coordinate. [Apache announcement](https://logging.apache.org/log4j/1.x/download.html) · [Maven Central metadata](https://repo.maven.apache.org/maven2/log4j/log4j/maven-metadata.xml) |
| `pkg:maven/org.apache.logging.log4j/log4j-core` | [19.8K indexed dependents](https://mvnrepository.com/artifact/org.apache.logging.log4j/log4j-core) | 0 / 0 | Apache records end of maintenance for 2.12.x and 2.3.x on **2021-12-29**. The project retains an exceptional-fix policy in that phase. Review how to represent that phase before adding these two rows. [Apache maintenance table](https://logging.apache.org/log4j/2.x/download.html) · [Phase policy](https://logging.apache.org/log4j/2.x/versioning.html) |
| `pkg:maven/com.fasterxml.jackson.core/jackson-databind` | [44.6K indexed dependents](https://mvnrepository.com/artifact/com.fasterxml.jackson.core/jackson-databind) | 0 / 0 | FasterXML still describes 2.x as maintained, with separate branch policies and a Maven group change for 3.x. Earlier branch cutoffs need component-specific evidence. [Jackson versioning](https://github.com/FasterXML/jackson/blob/main/VERSIONING.md) |
| `pkg:maven/org.springframework.boot/spring-boot` | [5.1K indexed dependents](https://mvnrepository.com/artifact/org.springframework.boot/spring-boot) | 19 / 3 | Existing rules cover legacy boundaries and checkout extended-support rows. Reconcile version, support tier and product scope with Spring before adding any later line. [Spring Boot project and support](https://spring.io/projects/spring-boot#support) |

### First Maven batch

In [#1032](https://github.com/velella-sh/ebb/issues/1032), review one proposed rule, `java.maven.log4j.end-of-life-1x`, for `pkg:maven/log4j/log4j` and `vers:maven/>=1.0.0|<2.0.0`. Its source gives day-precision end of life on **2015-08-05**. The Maven Central [1.2.17 release](https://repo.maven.apache.org/maven2/log4j/log4j/1.2.17/log4j-1.2.17.pom) is a matching example. The legacy coordinate has no published 2.x line. Use `2.0.0` as a synthetic comparator boundary and [Log4j Core 2.24.3](https://repo.maven.apache.org/maven2/org/apache/logging/log4j/log4j-core/2.24.3/log4j-core-2.24.3.pom) as a separately published, nonmatching package. Keep the 2.x maintenance phases in a later review.

## NuGet packages

The NuGet Gallery package pages supply the approximate total download counts shown here as observed on **2026-11-28 UTC**. These figures cover all versions. Microsoft's package support policies and individual maintainer releases supply the lifecycle evidence.

| NuGet package identity | Gallery downloads | Rules | Maintainer evidence and remaining gaps |
| --- | --- | ---: | --- |
| `pkg:nuget/Newtonsoft.Json` | [10.0B](https://www.nuget.org/packages/Newtonsoft.Json) | 0 / 0 | The project publishes release notes. The checked history gives no version-line end-of-support date. [Json.NET releases](https://github.com/JamesNK/Newtonsoft.Json/releases) |
| `pkg:nuget/Microsoft.EntityFrameworkCore` | [2.8B](https://www.nuget.org/packages/Microsoft.EntityFrameworkCore) | 0 / 0 | Microsoft lists **2026-11-10** as the support boundary for EF Core 8.0 and 9.0 in its release table. Keep EF Core distinct from EF6 and verify scope per package. [EF Core release and support table](https://learn.microsoft.com/en-us/ef/core/what-is-new/) |
| `pkg:nuget/EntityFramework` | [456.4M](https://www.nuget.org/packages/EntityFramework) | 0 / 0 | Microsoft says EF6 versions 6.0–6.4 are unsupported and only the latest patch of the latest EF6 version is supported. The policy gives no cutoff day for the older lines. Review an undated rule separately. [Entity Framework support policies](https://learn.microsoft.com/en-us/ef/efcore-and-ef6/support) |
| `pkg:nuget/Microsoft.AspNet.Mvc` | [320.7M](https://www.nuget.org/packages/Microsoft.AspNet.Mvc) | 0 / 0 | Microsoft lists end of support for ASP.NET MVC 4 on **2019-07-01** and continues to list MVC 5.x as supported. The Gallery verifies 4.x and 5.x on the same package ID. [ASP.NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy/aspnet) |
| `pkg:nuget/Microsoft.Azure.ServiceBus` | [162.0M](https://www.nuget.org/packages/Microsoft.Azure.ServiceBus) | 1 / 1 | The existing all-version deprecation entry records the legacy client boundary. Review any new event against the current Gallery metadata and the existing rule first. [Current rule](https://github.com/velella-sh/ebb/blob/c4ead4650f3bfddfa196c80f99d56bf5aa8527e9/registry/dotnet.json) |

### First NuGet batch

In [#1033](https://github.com/velella-sh/ebb/issues/1033), review one proposed rule, `dotnet.package.microsoft-aspnet-mvc.end-of-support-4`, for `pkg:nuget/Microsoft.AspNet.Mvc` and `vers:nuget/>=4.0.0|<5.0.0`. The policy gives day-precision end of support on **2019-07-01**. Use Gallery versions [4.0.20710](https://www.nuget.org/packages/Microsoft.AspNet.Mvc/4.0.20710) and [5.3.0](https://www.nuget.org/packages/Microsoft.AspNet.Mvc/5.3.0) as the matching and nonmatching examples. EF Core's dated boundaries can follow after the affected EF Core package scope is verified.

## npm packages

Evidence checked on **2026-11-28 UTC** against [checkout 5c9103a](https://github.com/velella-sh/ebb/tree/5c9103af1fd488cb5b8796c998dc8f3e0acf8bbf/registry) and the same signed 2026.11.11 snapshot. Both contain 83 rules across 74 npm PURLs. The table samples frequently downloaded general-purpose dependencies and two already-covered legacy packages. Rank is within these twelve packages. The [npm downloads API](https://github.com/npm/registry/blob/main/docs/download-counts.md) supplied counts for **2026-11-16 through 2026-11-22 UTC**, inclusive. Each package's npm registry metadata was checked for [per-version deprecation flags](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md), including prereleases. A flag count describes the registry read on that day. Specific lifecycle claims require the associated notice and its scope.

| Sample rank | Canonical package identity | Downloads in window | Rules, checkout / signed | Flagged / published versions | Evidence and next review |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | `pkg:npm/debug` | 977,218,258 | 0 / 0 | 17 / 77 | Several release-specific flags and two ranges share a regression notice. Audit each notice separately. [npm metadata](https://registry.npmjs.org/debug) |
| 2 | `pkg:npm/tslib` | 682,964,001 | 0 / 0 | 1 / 47 | The `1.12.0` flag identifies a compatibility regression and recommends replacements by TypeScript line. The notice gives no deprecation date. [Flagged 1.12.0](https://registry.npmjs.org/tslib/1.12.0) · [Unflagged 1.13.0](https://registry.npmjs.org/tslib/1.13.0) |
| 3 | `pkg:npm/node-fetch` | 300,609,978 | 0 / 0 | 9 / 96 | Flags cover individual regressions and prereleases. The move to ESM in 3.x is a separate compatibility change. [npm metadata](https://registry.npmjs.org/node-fetch) · [Maintainer upgrade guide](https://github.com/node-fetch/node-fetch/blob/main/docs/v3-UPGRADE-GUIDE.md) |
| 4 | `pkg:npm/chokidar` | 292,666,295 | 0 / 0 | 44 / 110 | The notice discusses Chokidar 2 and Node 14 compatibility, and flags releases outside 2.x. Check exact flagged versions before proposing a range. [npm metadata](https://registry.npmjs.org/chokidar) |
| 5 | `pkg:npm/react` | 275,732,766 | 0 / 0 | 2 / 3,025 | The two notices describe an early package rename and a broken individual React release. The evidence supports neither a shared version range nor a retired React major. [Early rename](https://registry.npmjs.org/react/0.7.1) · [Flagged 16.6.2](https://registry.npmjs.org/react/16.6.2) |
| 6 | `pkg:npm/%40babel/core` | 270,859,571 | 0 / 0 | 0 / 240 | No version carries a flag in the checked metadata. Individual Babel proposal plugins have separate package identities. [npm metadata](https://registry.npmjs.org/@babel%2Fcore) |
| 7 | `pkg:npm/lodash` | 211,573,812 | 0 / 0 | 1 / 117 | The registry flags `4.18.0` as a bad release and gives no deprecation date. Keep the scope to that exact release. [Flagged 4.18.0](https://registry.npmjs.org/lodash/4.18.0) · [Unflagged 4.18.1](https://registry.npmjs.org/lodash/4.18.1) |
| 8 | `pkg:npm/mkdirp` | 173,138,881 | 0 / 0 | 25 / 42 | The legacy support notice also points to a different API in `1.x`. Verify prerelease boundaries before modeling the flagged line. [npm metadata](https://registry.npmjs.org/mkdirp) |
| 9 | `pkg:npm/axios` | 150,124,651 | 0 / 0 | 52 / 148 | There are several release-level notices. The count alone gives no major-line retirement date. [npm metadata](https://registry.npmjs.org/axios) · [Maintainer support and security policy](https://github.com/axios/axios/blob/v1.x/SECURITY.md) |
| 10 | `pkg:npm/inflight` | 131,262,549 | 1 / 1 | 7 / 7 | The existing rule covers the package. All published versions carry the unsupported notice. [npm metadata](https://registry.npmjs.org/inflight) |
| 11 | `pkg:npm/core-js` | 101,193,377 | 0 / 0 | 234 / 290 | The notice names releases before `3.23.3` as unmaintained. Verify the npm comparator against the complete flagged set before translating that statement into a rule. [Flagged 3.23.2](https://registry.npmjs.org/core-js/3.23.2) · [Unflagged 3.23.3](https://registry.npmjs.org/core-js/3.23.3) |
| 12 | `pkg:npm/request` | 13,613,888 | 2 / 2 | 126 / 126 | The npm and OSV rows both record deprecation. All published versions carry a deprecation flag. [npm metadata](https://registry.npmjs.org/request) · [Maintainer notice](https://github.com/request/request/issues/3142) |

To reproduce the sample ranking, query the fixed window with [the unscoped package list](https://api.npmjs.org/downloads/point/2026-11-16:2026-11-22/axios,chokidar,core-js,debug,inflight,lodash,mkdirp,node-fetch,react,request,tslib) and [the scoped package](https://api.npmjs.org/downloads/point/2026-11-16:2026-11-22/%40babel%2Fcore), then sort their rows by download count descending and package name ascending. Each `Rules` cell counts the exact PURL in the two stated datasets.

### First npm batch

The [first rule batch](https://github.com/velella-sh/ebb/pull/1072) contains seven proposed rules for `uuid` and five `@types` packages, with package-version metadata and released matching and nonmatching cases. The notices give no deprecation date. The proposed rows await maintainer review. They are outside this table's existing-rule counts. Two later candidates from this sample are `tslib` `1.12.0` and `lodash` `4.18.0`, each scoped to exactly one flagged release. The example versions above establish the boundary for independent review.

## OpenSSH and curl upstream support

The following findings were checked on **2026-11-28 UTC** for the [requested infrastructure coverage review](https://github.com/velella-sh/ebb/issues/751).

### OpenSSH

OpenSSH's release notes describe fixes in named releases. The security page documents individual fixes and affected versions, and the problem-reporting guide directs readers to check for patches and newer versions. The portable release guide says Portable OpenSSH and OpenBSD base releases have independent schedules and asks users of vendor-modified versions to consult their vendor. The checked upstream documents provide no general commitment about which historical OpenSSH release lines receive fixes and no dated upstream support-end calendar. Keep individual fix releases, Portable OpenSSH and downstream distribution maintenance distinct. There is no lifecycle row to propose from these sources. [Release notes](https://www.openssh.org/releasenotes.html) · [Security](https://www.openssh.org/security.html) · [Problem reports](https://www.openssh.org/report.html) · [Portable releases](https://www.openssh.org/portable.html)

### curl

The project's bug-reporting guide explains that it lacks capacity to maintain multiple public branches and asks reporters to try a newer version. The public release table dates releases. The checked upstream documents provide no dated support-end schedule for public curl or libcurl versions. Rock-solid curl is a distinct commercial offering with separately numbered releases, maintained branches and a five-year support term from the first Rock-solid release on each branch. Distribution backports have their own support scope. Record the public upstream finding without a lifecycle row. [Bugs in old versions](https://curl.se/docs/bugs.html#bugs-in-old-versions) · [Public release table](https://curl.se/docs/releases.html) · [Version numbering](https://curl.se/docs/versions.html) · [Commercial branch terms](https://rock-solid.curl.dev/details.html)
