---
title: Database, OS and PyPI coverage inventories
description: Dated lifecycle evidence and proposed first review batches for databases, operating systems and PyPI packages.
layout: doc
permalink: /coverage-inventories/
---

Evidence checked on **2026-11-28 UTC**. Coverage counts compare [checkout 50a805e](https://github.com/velella-sh/ebb/tree/50a805e093e0eeb76727a8e5da9d6877c39c22cb/registry) (862 rules) with the [signed 2026.11.11 snapshot](https://github.com/velella-sh/ebb/releases/tag/data-v2026.11.11) (782 rules, SHA-256 `09f3f558e6708b6f7ec8fd4df0494601d4c1c99eb50526f7db20591a3852f3a4`). Each count is the number of rules for that exact PURL across all registries, shown as **checkout / signed**. A zero records an evidence coverage gap. The proposed ranges and rule IDs designate work for human review in later PRs.

## Databases

Prioritize the established PostgreSQL engine and provider identities so that a community retirement cannot accidentally be applied to customer workloads on a managed service. Dates below retain the vendor's stated phase and precision.

| Product, provider or edition | Ebb identity | Rules | Verified evidence and remaining gaps |
| --- | --- | ---: | --- |
| PostgreSQL Community | `pkg:generic/postgresql` | 5 / 5 | Majors 10–14 have rows. The community lists 14 as unsupported after its final release on 2026-11-12, and the cutoff for 15 as 2027-11-11. The 14 row still says scheduled, and 15 has no row. [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/) |
| Amazon RDS for PostgreSQL | `pkg:generic/aws-rds/postgres` | 6 / 6 | Existing coverage spans 9.6 and 10–14. RDS 15 standard support ends 2028-02-29. Its paid Extended Support tier ends 2031-02-28. Both provider boundaries are separate gaps. [RDS release calendar](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-release-calendar.html#postgresql-release-calendar-major-versions) |
| Amazon Aurora PostgreSQL | `pkg:generic/aws-aurora/postgresql` | 4 / 4 | Existing rows span 11–14. The Aurora 15 calendar gives a major-line standard boundary of 2028-02-29 and an Extended Support end of 2031-02-28. It also records individual minor cutoffs and currently names 15.10 for the extended tier. An Aurora rule needs its own major or minor scope. [Aurora PostgreSQL release calendar](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/aurorapostgresql-release-calendar.html#aurorapostgresql-release-calendar-major-versions) |
| Azure Database for PostgreSQL Flexible Server | `pkg:generic/azure-database-postgresql` | 1 / 1 | The existing row covers the 11–13 standard-support boundary. Azure lists 2027-01-31 for version 14 standard support. Extended Support has its own terms and needs a separate entry. [Azure Flexible Server version policy](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-version-policy#support-policy) |
| Google Cloud SQL for PostgreSQL | `pkg:generic/google-cloud-sql-postgresql` | 2 / 2 | Existing rows cover transitions for 9.6–13. The provider lists 2027-02-01 as the Extended Support start for 14 and 2030-02-01 separately as its deprecation date. Both 14 boundaries are gaps. [Cloud SQL version policies](https://docs.cloud.google.com/sql/docs/postgres/db-versions#major-and-minor-versions-supported) |
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
