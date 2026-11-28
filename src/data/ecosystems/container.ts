// Generated file - do not edit directly. Run npm run build:ecosystems.
import type { RegistryV2, RegistryV2Rule } from "../../registry.js";

export const ecosystem = "container" as const;

export const rules: readonly RegistryV2Rule[] = [
  {
    id: "container.node.eol-21-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/node",
    vers: "vers:semver/<22.0.0",
    event: "end-of-life",
    title: "Node.js image release lines 21 and older are end-of-life",
    summary:
      "These Node.js release lines no longer receive security or bug fixes, so images tagged with them are built on an unsupported runtime.",
    severity: "high",
    replacement: "A node image on a supported release line, such as node:22",
    replacements: [
      {
        purl: "pkg:docker/library/node",
        name: "node:22",
        kind: "upgrade",
        vers: "vers:semver/>=22.0.0|<23.0.0",
        note: "Review Node.js LTS maintenance and rebuild dependencies for the new release.",
      },
    ],
    deadline: "2026-04-30",
    sources: [
      {
        title: "Node.js end-of-life releases",
        url: "https://nodejs.org/en/about/eol",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://nodejs.org/en/about/eol",
        archivedAt: "2026-10-16",
      },
      {
        title: "Node.js Release Working Group schedule",
        url: "https://github.com/nodejs/Release/blob/main/schedule.json",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/nodejs/Release/blob/main/schedule.json",
        archivedAt: "2026-10-16",
      },
      {
        title: "Docker Official Image tags for node",
        url: "https://github.com/docker-library/official-images/blob/master/library/node",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "container-official-images",
    },
    migration: {
      constraints: [
        "Keep the Dockerfile base image, Compose image, CI service containers, and the engines field in package.json on one supported Node.js release line.",
        "Confirm native modules and production dependencies support the target Node.js major.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        {
          command: "docker run --rm IMAGE node --version",
          purpose: "Confirm the container runs the intended Node.js version.",
        },
      ],
    },
  },
  {
    id: "container.node.eol-22-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/node",
    vers: "vers:semver/>=22.0.0|<23.0.0",
    event: "scheduled-end-of-life",
    title: "Node.js image release line 22 reaches end-of-life on 2027-04-30",
    summary:
      "Node.js 22 is scheduled to stop receiving security and bug fixes on 2027-04-30, so images tagged with it will then be built on an unsupported runtime.",
    severity: "low",
    replacement: "A node image on a later supported release line, such as node:24",
    replacements: [
      {
        purl: "pkg:docker/library/node",
        name: "node:24",
        kind: "upgrade",
        vers: "vers:semver/>=24.0.0|<25.0.0",
        note: "Review Node.js LTS maintenance and rebuild dependencies for the new release.",
      },
    ],
    deadline: "2027-04-30",
    sources: [
      {
        title: "Node.js end-of-life releases",
        url: "https://nodejs.org/en/about/eol",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://nodejs.org/en/about/eol",
        archivedAt: "2026-10-16",
      },
      {
        title: "Node.js Release Working Group schedule",
        url: "https://github.com/nodejs/Release/blob/main/schedule.json",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261024000000/https://github.com/nodejs/Release/blob/main/schedule.json",
        archivedAt: "2026-10-24",
      },
      {
        title: "Docker Official Image tags for node",
        url: "https://github.com/docker-library/official-images/blob/master/library/node",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-24",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "container-official-images",
    },
    migration: {
      constraints: [
        "Keep the Dockerfile base image, Compose image, CI service containers, and the engines field in package.json on one supported Node.js release line.",
        "Confirm native modules and production dependencies support the target Node.js major.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        {
          command: "docker run --rm IMAGE node --version",
          purpose: "Confirm the container runs the intended Node.js version.",
        },
      ],
    },
  },
  {
    id: "container.python.eol-3.10-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/python",
    vers: "vers:semver/<3.11.0",
    event: "end-of-life",
    title: "Python image release lines 3.10 and older are end-of-life",
    summary: "These Python release lines no longer receive security or bug fixes from the Python core team.",
    severity: "high",
    replacement: "A python image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/python",
        name: "python:3.12-trixie",
        kind: "upgrade",
        vers: "vers:semver/>=3.12.0|<3.13.0",
        note: "Select a Python 3.12 image variant compatible with the deployment and dependencies.",
      },
    ],
    deadline: "2026-10-01",
    sources: [
      {
        title: "Status of Python versions",
        url: "https://devguide.python.org/versions/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://devguide.python.org/versions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "Python release cycle (machine-readable)",
        url: "https://peps.python.org/api/release-cycle.json",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://peps.python.org/api/release-cycle.json",
        archivedAt: "2026-10-16",
      },
      {
        title: "Docker Official Image tags for python",
        url: "https://github.com/docker-library/official-images/blob/master/library/python",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "container-official-images",
    },
    migration: {
      constraints: [
        "Keep the base image, requires-python, CI matrices, and deployment runtimes on one supported Python release.",
        "Confirm binary wheels and dependencies support the target Python release; rebuild any virtual environment or wheel cache inside the image.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        {
          command: "docker run --rm IMAGE python --version",
          purpose: "Confirm the container runs the intended Python version.",
        },
      ],
    },
  },
  {
    id: "container.python.eol-3.11-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/python",
    vers: "vers:semver/>=3.11.0|<3.12.0",
    event: "scheduled-end-of-life",
    title: "Python image release line 3.11 reaches end-of-life on 2027-10-31",
    summary:
      "Python 3.11 is scheduled to stop receiving security fixes from the Python core team on 2027-10-31, so images tagged with it will then be built on an unsupported runtime.",
    severity: "low",
    replacement: "A python image on a later supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/python",
        name: "python:3.12-trixie",
        kind: "upgrade",
        vers: "vers:semver/>=3.12.0|<3.13.0",
        note: "Select a Python 3.12 image variant compatible with the deployment and dependencies.",
      },
    ],
    deadline: "2027-10-31",
    sources: [
      {
        title: "Status of Python versions",
        url: "https://devguide.python.org/versions/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://devguide.python.org/versions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "Python release cycle (machine-readable)",
        url: "https://peps.python.org/api/release-cycle.json",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261103000000/https://peps.python.org/api/release-cycle.json",
        archivedAt: "2026-11-03",
      },
      {
        title: "Docker Official Image tags for python",
        url: "https://github.com/docker-library/official-images/blob/master/library/python",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-11-03",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "container-official-images",
    },
    migration: {
      constraints: [
        "Keep the base image, requires-python, CI matrices, and deployment runtimes on one supported Python release.",
        "Confirm binary wheels and dependencies support the target Python release; rebuild any virtual environment or wheel cache inside the image.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        {
          command: "docker run --rm IMAGE python --version",
          purpose: "Confirm the container runs the intended Python version.",
        },
      ],
    },
  },
  {
    id: "container.postgres.eol-13-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/postgres",
    vers: "vers:semver/<14.0.0",
    event: "end-of-life",
    title: "PostgreSQL image major versions 13 and older are end-of-life",
    summary: "The PostgreSQL project no longer releases fixes for these major versions.",
    severity: "high",
    replacement: "A postgres image on a supported major version (the upgrade needs a dump/restore or pg_upgrade)",
    replacements: [
      {
        purl: "pkg:docker/library/postgres",
        name: "postgres:15",
        kind: "upgrade",
        vers: "vers:semver/>=15.0.0|<16.0.0",
        note: "Use an official PostgreSQL 15 image. Run pg_upgrade or dump and restore before restarting the service on the new major.",
      },
    ],
    deadline: "2025-11-13",
    sources: [
      {
        title: "PostgreSQL versioning policy",
        url: "https://www.postgresql.org/support/versioning/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://www.postgresql.org/support/versioning/",
        archivedAt: "2026-10-16",
      },
      {
        title: "Docker Official Image tags for PostgreSQL",
        url: "https://github.com/docker-library/official-images/blob/master/library/postgres",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "A major PostgreSQL upgrade does not reuse the old data directory: the data must be dumped and restored, or migrated with pg_upgrade, before the new image can start on it.",
        "Check extensions, client libraries, and any init scripts against the target major version, and take a backup first.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker compose config", purpose: "Validate the Compose file after changing the image tag." },
        {
          command: "docker compose run --rm db postgres --version",
          purpose: "Confirm the database container runs the intended major version (service name may differ).",
        },
      ],
    },
  },
  {
    id: "container.postgres.eol-14-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/postgres",
    vers: "vers:semver/>=14.0.0|<15.0.0",
    event: "scheduled-end-of-life",
    title: "PostgreSQL image release line 14 reaches end-of-life on 2026-11-12",
    summary: "The PostgreSQL 14 release line is scheduled to stop receiving fixes from the vendor on 2026-11-12.",
    severity: "low",
    replacement: "A postgres image on a later supported major version (the upgrade needs a dump/restore or pg_upgrade)",
    replacements: [
      {
        purl: "pkg:docker/library/postgres",
        name: "postgres:15",
        kind: "upgrade",
        vers: "vers:semver/>=15.0.0|<16.0.0",
        note: "Use an official PostgreSQL 15 image. Run pg_upgrade or dump and restore before restarting the service on the new major.",
      },
    ],
    deadline: "2026-11-12",
    sources: [
      {
        title: "PostgreSQL release policy (vendor)",
        url: "https://www.postgresql.org/support/versioning/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261024000000/https://www.postgresql.org/support/versioning/",
        archivedAt: "2026-10-24",
      },
      {
        title: "Docker Official Image tags for PostgreSQL",
        url: "https://github.com/docker-library/official-images/blob/master/library/postgres",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-24",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "A major PostgreSQL upgrade does not reuse the old data directory: the data must be dumped and restored, or migrated with pg_upgrade, before the new image can start on it.",
        "Check extensions, client libraries, and any init scripts against the target major version, and take a backup first.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker compose config", purpose: "Validate the Compose file after changing the image tag." },
        {
          command: "docker compose run --rm db postgres --version",
          purpose: "Confirm the database container runs the intended major version (service name may differ).",
        },
      ],
    },
  },
  {
    id: "container.mysql.eol-8.0-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/mysql",
    vers: "vers:semver/<8.1.0",
    event: "end-of-life",
    title: "MySQL image release lines 8.0 and older are past end-of-life",
    summary:
      "Oracle lists MySQL 8.0 and 5.7 as covered only by Sustaining Support, which means no new fixes. The mysql.com end-of-life notice refuses automated requests (HTTP 403), so it can only be reviewed by hand.",
    severity: "high",
    replacement: "A mysql image on a supported release such as the 8.4 LTS line",
    replacements: [
      {
        purl: "pkg:docker/library/mysql",
        name: "mysql:8.4",
        kind: "upgrade",
        vers: "vers:semver/>=8.4.0|<8.5.0",
        note: "Follow the supported MySQL major upgrade procedure and back up data.",
      },
    ],
    deadline: "2026-04-21",
    sources: [
      {
        title: "MySQL end-of-life notice",
        url: "https://www.mysql.com/support/eol-notice.html",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261107000000/https://www.mysql.com/support/eol-notice.html",
        archivedAt: "2026-11-07",
      },
      {
        title: "Docker Official Image tags for mysql",
        url: "https://github.com/docker-library/official-images/blob/master/library/mysql",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-11-07",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "A new MySQL release line can need a data directory upgrade; read the upgrade notes and take a backup before starting the new image on existing data.",
        "Check SQL modes, authentication plugins, and client libraries against the target release.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker compose config", purpose: "Validate the Compose file after changing the image tag." },
        {
          command: "docker compose run --rm db mysqld --version",
          purpose: "Confirm the database container runs the intended release (service name may differ).",
        },
      ],
    },
  },
  {
    id: "container.ruby.eol-3.2-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/ruby",
    vers: "vers:semver/<3.3.0",
    event: "end-of-life",
    title: "Ruby image release lines 3.2 and older are end-of-life",
    summary: "These Ruby branches no longer receive security or bug fixes.",
    severity: "high",
    replacement: "A ruby image on a supported branch",
    replacements: [
      {
        purl: "pkg:docker/library/ruby",
        name: "ruby:3.4",
        kind: "upgrade",
        vers: "vers:semver/>=3.4.0|<3.5.0",
        note: "Ruby 3.4 is in normal maintenance. Test native dependencies with the new image.",
      },
    ],
    deadline: "2026-04-01",
    sources: [
      {
        title: "Ruby maintenance branches",
        url: "https://www.ruby-lang.org/en/downloads/branches/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://www.ruby-lang.org/en/downloads/branches/",
        archivedAt: "2026-10-16",
      },
      {
        title: "Docker Official Image tags for ruby",
        url: "https://github.com/docker-library/official-images/blob/master/library/ruby",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Keep the base image, .ruby-version, Gemfile ruby requirement, and CI matrices on one supported Ruby branch.",
        "Confirm gems with native extensions build on the target Ruby, and rebuild bundled gems inside the image.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        {
          command: "docker run --rm IMAGE ruby --version",
          purpose: "Confirm the container runs the intended Ruby version.",
        },
      ],
    },
  },
  {
    id: "container.ruby.eol-3.3-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/ruby",
    vers: "vers:semver/>=3.3.0|<3.4.0",
    event: "scheduled-end-of-life",
    title: "Ruby image release line 3.3 reaches end-of-life on 2027-03-31",
    summary:
      "Ruby 3.3 is in security maintenance and is scheduled to stop receiving fixes from the Ruby core team on 2027-03-31.",
    severity: "low",
    replacement: "A ruby image on a later supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/ruby",
        name: "ruby:3.4",
        kind: "upgrade",
        vers: "vers:semver/>=3.4.0|<3.5.0",
        note: "Ruby 3.4 is in normal maintenance. Test native dependencies with the new image.",
      },
    ],
    deadline: "2027-03-31",
    sources: [
      {
        title: "Ruby maintenance branches",
        url: "https://www.ruby-lang.org/en/downloads/branches/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261029000000/https://www.ruby-lang.org/en/downloads/branches/",
        archivedAt: "2026-10-29",
      },
      {
        title: "Docker Official Image tags for ruby",
        url: "https://github.com/docker-library/official-images/blob/master/library/ruby",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-29",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, .ruby-version, Gemfile ruby requirement, and CI matrices on one supported Ruby branch.",
        "Confirm gems with native extensions build on the target Ruby, and rebuild bundled gems inside the image.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        {
          command: "docker run --rm IMAGE ruby --version",
          purpose: "Confirm the container runs the intended Ruby version.",
        },
      ],
    },
  },
  {
    id: "container.caddy.eol-1-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/caddy",
    vers: "vers:semver/<2.0.0",
    event: "end-of-life",
    title: "Caddy image release lines 1 and older are end-of-life",
    summary: "These Caddy release lines no longer receive fixes from the vendor.",
    severity: "high",
    replacement: "A caddy image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/caddy",
        name: "caddy:2.11.9-alpine",
        kind: "upgrade",
        vers: "vers:semver/2.11.9",
        note: "The Caddy project publishes 2.11.9 as its latest stable release. Test the updated server configuration.",
      },
    ],
    deadline: "2020-07-01",
    sources: [
      {
        title: "Caddy release policy (vendor)",
        url: "https://github.com/caddyserver/caddy/security",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261020000000/https://github.com/caddyserver/caddy/security",
        archivedAt: "2026-10-20",
      },
      {
        title: "Caddy 2.11.9 stable release",
        url: "https://github.com/caddyserver/caddy/releases/tag/v2.11.9",
        accessedAt: "2026-11-28",
      },
      {
        title: "Docker Official Image tags for caddy",
        url: "https://github.com/docker-library/official-images/blob/master/library/caddy",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use caddy on one supported Caddy release line.",
        "Confirm the application and its data or configuration work on the target Caddy release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.golang.eol-1.25-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/golang",
    vers: "vers:semver/<1.26.0",
    event: "end-of-life",
    title: "Go image release lines 1.25 and older are end-of-life",
    summary: "These Go release lines no longer receive fixes from the vendor.",
    severity: "high",
    replacement: "A golang image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/golang",
        name: "golang:1.27-trixie",
        kind: "upgrade",
        vers: "vers:semver/>=1.27.0|<1.28.0",
        note: "Go supports the two most recent release lines. Rebuild with the latest available patch.",
      },
    ],
    deadline: "2026-08-19",
    sources: [
      {
        title: "Go release policy (vendor)",
        url: "https://go.dev/doc/devel/release#policy",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261020000000/https://go.dev/doc/devel/release#policy",
        archivedAt: "2026-10-20",
      },
      {
        title: "Docker Official Image tags for golang",
        url: "https://github.com/docker-library/official-images/blob/master/library/golang",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use golang on one supported Go release line.",
        "Confirm the application and its data or configuration work on the target Go release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.mariadb.eol-10.10-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/mariadb",
    vers: "vers:semver/<10.11.0",
    event: "end-of-life",
    title: "MariaDB image release lines 10.10 and older are end-of-life",
    summary: "These MariaDB release lines no longer receive fixes from the vendor.",
    severity: "high",
    replacement: "A mariadb image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/mariadb",
        name: "mariadb:10.11",
        kind: "upgrade",
        vers: "vers:semver/>=10.11.0|<10.12.0",
        note: "MariaDB lists community maintenance through 2028-02-16. Check the major-version upgrade instructions.",
      },
    ],
    deadline: "2026-07-06",
    sources: [
      {
        title: "MariaDB release policy (vendor)",
        url: "https://mariadb.org/about/#maintenance-policy",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261020000000/https://mariadb.org/about/#maintenance-policy",
        archivedAt: "2026-10-20",
      },
      {
        title: "Docker Official Image tags for mariadb",
        url: "https://github.com/docker-library/official-images/blob/master/library/mariadb",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use mariadb on one supported MariaDB release line.",
        "Confirm the application and its data or configuration work on the target MariaDB release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.redis.eol-6.0-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/redis",
    vers: "vers:semver/<6.2.0",
    event: "end-of-life",
    title: "Redis image release lines 6.0 and older are end-of-life",
    summary: "These Redis release lines no longer receive fixes from the vendor.",
    severity: "high",
    replacement: "A redis image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/redis",
        name: "redis:7.4",
        kind: "upgrade",
        vers: "vers:semver/>=7.4.0|<7.5.0",
        note: "Redis lists the 7.4 line for extended maintenance. Check deployment and licensing requirements.",
      },
    ],
    deadline: "2022-05-31",
    sources: [
      {
        title: "Redis release policy (vendor)",
        url: "https://redis.io/docs/latest/operate/oss_and_stack/install/version-mgmt/",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261020000000/https://redis.io/docs/latest/operate/oss_and_stack/install/version-mgmt/",
        archivedAt: "2026-10-20",
      },
      {
        title: "Docker Official Image tags for redis",
        url: "https://github.com/docker-library/official-images/blob/master/library/redis",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use redis on one supported Redis release line.",
        "Confirm the application and its data or configuration work on the target Redis release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.redis.eol-6.2-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/redis",
    vers: "vers:semver/>=6.2.0|<6.3.0",
    event: "scheduled-end-of-life",
    title: "Redis image release line 6.2 reaches end-of-life on 2027-04-01",
    summary: "The Redis 6.2 release line is scheduled to stop receiving fixes from the vendor on 2027-04-01.",
    severity: "low",
    replacement: "A redis image on a later supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/redis",
        name: "redis:7.4",
        kind: "upgrade",
        vers: "vers:semver/>=7.4.0|<7.5.0",
        note: "Redis lists the 7.4 line for extended maintenance. Check deployment and licensing requirements.",
      },
    ],
    deadline: "2027-04-01",
    sources: [
      {
        title: "Redis release policy (vendor)",
        url: "https://redis.io/docs/latest/operate/oss_and_stack/install/version-mgmt/",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261030000000/https://redis.io/docs/latest/operate/oss_and_stack/install/version-mgmt/",
        archivedAt: "2026-10-30",
      },
      {
        title: "Docker Official Image tags for redis",
        url: "https://github.com/docker-library/official-images/blob/master/library/redis",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-30",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use redis on one supported Redis release line.",
        "Confirm the application and its data or configuration work on the target Redis release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.zookeeper.eol-3.7-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/zookeeper",
    vers: "vers:semver/<3.8.0",
    event: "end-of-life",
    title: "Apache ZooKeeper image release lines 3.7 and older are end-of-life",
    summary: "These Apache ZooKeeper release lines no longer receive fixes from the vendor.",
    severity: "high",
    replacement: "A zookeeper image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/zookeeper",
        name: "zookeeper:3.9.7",
        kind: "upgrade",
        vers: "vers:semver/3.9.7",
        note: "Apache lists 3.9.7 as stable. Check the supported rolling-upgrade path.",
      },
    ],
    deadline: "2024-01-19",
    sources: [
      {
        title: "Apache ZooKeeper release policy (vendor)",
        url: "https://zookeeper.apache.org/releases/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261020000000/https://zookeeper.apache.org/releases/",
        archivedAt: "2026-10-20",
      },
      {
        title: "Docker Official Image tags for zookeeper",
        url: "https://github.com/docker-library/official-images/blob/master/library/zookeeper",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use zookeeper on one supported ZooKeeper release line.",
        "Confirm the application and its data or configuration work on the target ZooKeeper release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.drupal.eol-10.5-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/drupal",
    vers: "vers:semver/<10.6.0",
    event: "end-of-life",
    title: "Drupal image release lines 10.5 and older are end-of-life",
    summary:
      "These Drupal release lines no longer receive security fixes from the vendor: the core release schedule ends security support for 10.5 when 11.4 is released, in the week of 2026-06-29, and lists 10.6 as the only supported minor of Drupal 10.",
    severity: "high",
    replacement: "A drupal image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/drupal",
        name: "drupal:11.4",
        kind: "upgrade",
        vers: "vers:semver/>=11.4.0|<11.5.0",
        note: "Drupal lists security support for 11.4 through 2027-04-21. Check module, database, and PHP requirements.",
      },
    ],
    deadline: "2026-07-01",
    sources: [
      {
        title: "Drupal release policy (vendor)",
        url: "https://www.drupal.org/about/core/policies/core-release-cycles/schedule",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261020000000/https://www.drupal.org/about/core/policies/core-release-cycles/schedule",
        archivedAt: "2026-10-20",
      },
      {
        title: "Docker Official Image tags for drupal",
        url: "https://github.com/docker-library/official-images/blob/master/library/drupal",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use drupal on one supported Drupal release line.",
        "Confirm the application and its data or configuration work on the target Drupal release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.traefik.eol-3.6-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/traefik",
    vers: "vers:semver/<3.7.0",
    event: "end-of-life",
    title: "Traefik image release lines 3.6 and older are end-of-life",
    summary:
      "These Traefik release lines no longer receive security fixes from the vendor: the release policy lists 3.7 as the only supported line, and security support for 3.6 ended on 2026-08-16.",
    severity: "high",
    replacement: "A traefik image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/traefik",
        name: "traefik:3.8",
        kind: "upgrade",
        vers: "vers:semver/>=3.8.0|<3.9.0",
        note: "Traefik lists 3.8 for active and security support. Review configuration changes.",
      },
    ],
    deadline: "2026-08-16",
    sources: [
      {
        title: "Traefik release policy (vendor)",
        url: "https://doc.traefik.io/traefik/deprecation/releases",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261020000000/https://doc.traefik.io/traefik/deprecation/releases",
        archivedAt: "2026-10-20",
      },
      {
        title: "Docker Official Image tags for traefik",
        url: "https://github.com/docker-library/official-images/blob/master/library/traefik",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use traefik on one supported Traefik release line.",
        "Confirm the application and its data or configuration work on the target Traefik release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.clickhouse.eol-26.2-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/clickhouse",
    vers: "vers:semver/<26.3.0",
    event: "end-of-life",
    title: "ClickHouse image release lines 26.2 and older are end-of-life",
    summary:
      "These ClickHouse release lines are listed as not supported with security updates in the vendor's security policy; 26.3 is the oldest line it still supports.",
    severity: "high",
    replacement: "A clickhouse image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/clickhouse",
        name: "clickhouse:26.8",
        kind: "upgrade",
        vers: "vers:semver/>=26.8.0|<26.9.0",
        note: "ClickHouse lists 26.8 for security updates. Review compatibility before changing image versions.",
      },
    ],
    sources: [
      {
        title: "ClickHouse security policy: supported versions",
        url: "https://github.com/ClickHouse/ClickHouse/blob/master/SECURITY.md",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261020000000/https://github.com/ClickHouse/ClickHouse/blob/master/SECURITY.md",
        archivedAt: "2026-10-20",
      },
      {
        title: "Docker Official Image tags for clickhouse",
        url: "https://github.com/docker-library/official-images/blob/master/library/clickhouse",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use clickhouse on one supported ClickHouse release line.",
        "Confirm the application and its data or configuration work on the target ClickHouse release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.couchbase.eol-7.2-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/couchbase",
    vers: "vers:semver/<7.6.0",
    event: "end-of-life",
    title: "Couchbase Server image release lines 7.2 and older are end-of-life",
    summary:
      "These Couchbase Server release lines are past their end-of-life date in the vendor's lifecycle schedule (7.2 reached end of life in July 2026; 7.6 is supported until March 2027).",
    severity: "high",
    replacement: "A couchbase image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/couchbase",
        name: "couchbase:enterprise-8.0.3",
        kind: "upgrade",
        vers: "vers:semver/8.0.3",
        note: "Couchbase lists Server 8.0 for maintenance through October 2028. Check the supported platform, edition, and upgrade path.",
      },
    ],
    deadline: "2026-07-31",
    sources: [
      {
        title: "Couchbase software lifecycle schedules",
        url: "https://www.couchbase.com/support-policy/EOL/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261020000000/https://www.couchbase.com/support-policy/EOL/",
        archivedAt: "2026-10-20",
      },
      {
        title: "Couchbase enterprise software support policy",
        url: "https://www.couchbase.com/support-policy/enterprise-software/",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261020000000/https://www.couchbase.com/support-policy/enterprise-software/",
        archivedAt: "2026-10-20",
      },
      {
        title: "Docker Official Image tags for couchbase",
        url: "https://github.com/docker-library/official-images/blob/master/library/couchbase",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use couchbase on one supported Couchbase Server release line.",
        "Confirm the application and its data or configuration work on the target Couchbase Server release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.couchdb.eol-3.3-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/couchdb",
    vers: "vers:semver/<3.4.0",
    event: "end-of-life",
    title: "Apache CouchDB image release lines 3.3 and older are end-of-life",
    summary:
      "The CouchDB project publishes CVE fixes only for the current release series and its immediate predecessor, so these older release lines receive no security fixes by policy.",
    severity: "high",
    replacement: "A couchdb image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/couchdb",
        name: "couchdb:3.5.3",
        kind: "upgrade",
        vers: "vers:semver/3.5.3",
        note: "Apache lists 3.5.3 as its current release. Review release notes and back up data before upgrading.",
      },
    ],
    sources: [
      {
        title: "Apache CouchDB security policy",
        url: "https://docs.couchdb.org/en/stable/cve/index.html",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261020000000/https://docs.couchdb.org/en/stable/cve/index.html",
        archivedAt: "2026-10-20",
      },
      { title: "Apache CouchDB current downloads", url: "https://couchdb.apache.org/", accessedAt: "2026-11-28" },
      {
        title: "Docker Official Image tags for couchdb",
        url: "https://github.com/docker-library/official-images/blob/master/library/couchdb",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use couchdb on one supported CouchDB release line.",
        "Confirm the application and its data or configuration work on the target CouchDB release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.phpmyadmin.eol-4.8-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/phpmyadmin",
    vers: "vers:semver/<4.9.0",
    event: "end-of-life",
    title: "phpMyAdmin image release lines 4.8 and older are end-of-life",
    summary:
      "These phpMyAdmin release lines are unsupported: the vendor's downloads page supports only the current stable line and the 4.9 LTS line, and says older releases are unsupported.",
    severity: "high",
    replacement: "A phpmyadmin image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/phpmyadmin",
        name: "phpmyadmin:5.2.3",
        kind: "upgrade",
        vers: "vers:semver/5.2.3",
        note: "phpMyAdmin identifies 5.2.3 as stable. Check PHP and database requirements.",
      },
    ],
    sources: [
      {
        title: "phpMyAdmin downloads and version support policy",
        url: "https://www.phpmyadmin.net/downloads/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261020000000/https://www.phpmyadmin.net/downloads/",
        archivedAt: "2026-10-20",
      },
      {
        title: "Docker Official Image tags for phpmyadmin",
        url: "https://github.com/docker-library/official-images/blob/master/library/phpmyadmin",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-20",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Keep the base image, Compose image, CI service containers, and deployment manifests that use phpmyadmin on one supported phpMyAdmin release line.",
        "Confirm the application and its data or configuration work on the target phpMyAdmin release; read the vendor's upgrade notes before moving across several release lines.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.ubuntu.eol-20.04-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/ubuntu",
    vers: "vers:semver/<20.10.0",
    event: "end-of-life",
    title: "Ubuntu image release lines 20.04 and older are past standard support end-of-life",
    summary: "These Ubuntu releases no longer receive standard security updates from the vendor.",
    severity: "high",
    replacement: "An ubuntu image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/ubuntu",
        name: "ubuntu:24.04",
        kind: "upgrade",
        vers: "vers:semver/>=24.4.0|<24.5.0",
        note: "Choose an official Ubuntu 24.04 image and rebuild the container.",
      },
    ],
    deadline: "2025-05-31",
    sources: [
      {
        title: "Ubuntu release cycle",
        url: "https://ubuntu.com/about/release-cycle",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261026000000/https://ubuntu.com/about/release-cycle",
        archivedAt: "2026-10-26",
      },
      {
        title: "Docker Official Image tags for ubuntu",
        url: "https://github.com/docker-library/official-images/blob/master/library/ubuntu",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-26",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Keep the base image and deployment manifests that use ubuntu on one supported Ubuntu release line.",
        "Confirm the application and its dependencies work on the target Ubuntu release.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.ubuntu.eol-22.04",
    ecosystem: "container",
    purl: "pkg:docker/library/ubuntu",
    vers: "vers:semver/>=22.0.0|<22.10.0",
    event: "scheduled-end-of-life",
    title: "Ubuntu image release line 22.04 reaches standard support end-of-life on 2027-06-01",
    summary: "Ubuntu 22.04 is scheduled to stop receiving standard security updates on 2027-06-01.",
    severity: "low",
    replacement: "An ubuntu image on a later supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/ubuntu",
        name: "ubuntu:24.04",
        kind: "upgrade",
        vers: "vers:semver/>=24.4.0|<24.5.0",
        note: "Choose an official Ubuntu 24.04 image and rebuild the container.",
      },
    ],
    deadline: "2027-06-01",
    sources: [
      {
        title: "Ubuntu release cycle",
        url: "https://ubuntu.com/about/release-cycle",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261026000000/https://ubuntu.com/about/release-cycle",
        archivedAt: "2026-10-26",
      },
      {
        title: "Docker Official Image tags for ubuntu",
        url: "https://github.com/docker-library/official-images/blob/master/library/ubuntu",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-26",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Keep the base image and deployment manifests that use ubuntu on one supported Ubuntu release line.",
        "Confirm the application and its dependencies work on the target Ubuntu release.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.debian.eol-11-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/debian",
    vers: "vers:semver/<12.0.0",
    event: "end-of-life",
    title: "Debian image release lines 11 and older are end-of-life",
    summary: "These Debian releases no longer receive LTS security updates from the vendor.",
    severity: "high",
    replacement: "A debian image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/debian",
        name: "debian:13",
        kind: "upgrade",
        vers: "vers:semver/>=13.0.0|<14.0.0",
        note: "Choose an official Debian 13 image for the required architecture and rebuild the container.",
      },
    ],
    deadline: "2026-08-31",
    sources: [
      {
        title: "Debian LTS",
        url: "https://wiki.debian.org/LTS",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261026000000/https://wiki.debian.org/LTS",
        archivedAt: "2026-10-26",
      },
      {
        title: "Debian Releases",
        url: "https://www.debian.org/releases/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261026000000/https://www.debian.org/releases/",
        archivedAt: "2026-10-26",
      },
      {
        title: "Docker Official Image tags for debian",
        url: "https://github.com/docker-library/official-images/blob/master/library/debian",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-26",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Keep the base image and deployment manifests that use debian on one supported Debian release line.",
        "Confirm the application and its dependencies work on the target Debian release.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.alpine.eol-3.20-and-older",
    ecosystem: "container",
    purl: "pkg:docker/library/alpine",
    vers: "vers:semver/<3.21.0",
    event: "end-of-life",
    title: "Alpine Linux image release lines 3.20 and older are end-of-life",
    summary: "These Alpine Linux releases no longer receive security updates from the vendor.",
    severity: "high",
    replacement: "An alpine image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/alpine",
        name: "alpine:3.22",
        kind: "upgrade",
        vers: "vers:semver/>=3.22.0|<3.23.0",
        note: "Choose an official Alpine 3.22 image and check maintenance for each package repository.",
      },
    ],
    deadline: "2026-04-01",
    sources: [
      {
        title: "Alpine Linux releases",
        url: "https://alpinelinux.org/releases/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261026000000/https://alpinelinux.org/releases/",
        archivedAt: "2026-10-26",
      },
      {
        title: "Docker Official Image tags for alpine",
        url: "https://github.com/docker-library/official-images/blob/master/library/alpine",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-26",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Keep the base image and deployment manifests that use alpine on one supported Alpine release line.",
        "Confirm the application and its dependencies work on the target Alpine release.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.alpine.eol-3.21",
    ecosystem: "container",
    purl: "pkg:docker/library/alpine",
    vers: "vers:semver/>=3.21.0|<3.22.0",
    event: "end-of-life",
    title: "Alpine Linux image release line 3.21 is end-of-life",
    summary: "Alpine Linux 3.21 no longer receives security updates; its release branch ended on 2026-11-01.",
    severity: "high",
    replacement: "An alpine image on a later supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/alpine",
        name: "alpine:3.22",
        kind: "upgrade",
        vers: "vers:semver/>=3.22.0|<3.23.0",
        note: "Choose an official Alpine 3.22 image and check maintenance for each package repository.",
      },
    ],
    deadline: "2026-11-01",
    sources: [
      {
        title: "Alpine Linux releases",
        url: "https://alpinelinux.org/releases/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261107000000/https://alpinelinux.org/releases/",
        archivedAt: "2026-11-07",
      },
      {
        title: "Docker Official Image tags for alpine",
        url: "https://github.com/docker-library/official-images/blob/master/library/alpine",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-11-07",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Keep the base image and deployment manifests that use alpine on one supported Alpine release line.",
        "Confirm the application and its dependencies work on the target Alpine release.",
      ],
      steps: [
        {
          id: "update-image-declaration",
          title: "Update the base image",
          instructions:
            "Change the reported FROM line or Compose image to a tag on a supported release line, and pin it to a digest if your policy requires.",
          targets: "declaration",
        },
        {
          id: "align-image-surfaces",
          title: "Align other image references",
          instructions:
            "Update other Dockerfiles, Compose files, CI service containers, and deployment manifests that use the same image so they agree.",
          targets: "all",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image on the new base." },
        { command: "docker run --rm IMAGE sh -c 'echo ok'", purpose: "Confirm the container starts on the new base." },
      ],
    },
  },
  {
    id: "container.dockerfile.maintainer",
    ecosystem: "container",
    purl: "pkg:generic/dockerfile",
    vers: "vers:semver/*",
    event: "deprecated",
    title: "The Dockerfile MAINTAINER instruction is deprecated",
    summary:
      "The Dockerfile reference marks MAINTAINER as deprecated because author metadata belongs in the org.opencontainers.image.authors label.",
    severity: "low",
    replacement: "A LABEL org.opencontainers.image.authors instruction carrying the same author text",
    sources: [
      {
        title: "Dockerfile reference: MAINTAINER (deprecated)",
        url: "https://docs.docker.com/reference/dockerfile/#maintainer-deprecated",
        accessedAt: "2026-10-31",
        archiveUrl:
          "https://web.archive.org/web/20261031000000/https://docs.docker.com/reference/dockerfile/#maintainer-deprecated",
        archivedAt: "2026-10-31",
      },
      {
        title: "Docker build check: MaintainerDeprecated",
        url: "https://docs.docker.com/reference/build-checks/maintainer-deprecated/",
        accessedAt: "2026-10-31",
        archiveUrl:
          "https://web.archive.org/web/20261031000000/https://docs.docker.com/reference/build-checks/maintainer-deprecated/",
        archivedAt: "2026-10-31",
      },
    ],
    provenance: {
      observedAt: "2026-10-31",
      reviewedAt: "2026-10-31",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Keep the author text exactly as it is written.",
        "Quote the label value so spaces and punctuation stay part of the value.",
      ],
      steps: [
        {
          id: "replace-maintainer",
          title: "Replace MAINTAINER with the OCI author label",
          instructions:
            "Replace the MAINTAINER instruction with LABEL org.opencontainers.image.authors, using the same author text as a quoted value.",
          targets: "declaration",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image with the rewritten Dockerfile." },
        {
          command: "docker inspect IMAGE",
          purpose: "Confirm the image carries the org.opencontainers.image.authors label.",
        },
      ],
    },
  },
  {
    id: "container.dockerfile.legacy-env-format",
    ecosystem: "container",
    purl: "pkg:generic/dockerfile",
    vers: "vers:semver/*",
    event: "deprecated",
    title: 'The Dockerfile legacy "ENV key value" form is deprecated',
    summary:
      "Docker's LegacyKeyValueFormat build check flags the space-separated ENV form and recommends writing each assignment as key=value.",
    severity: "low",
    replacement: "The ENV key=value form, with the value quoted when it contains spaces",
    sources: [
      {
        title: "Docker build check: LegacyKeyValueFormat",
        url: "https://docs.docker.com/reference/build-checks/legacy-key-value-format/",
        accessedAt: "2026-10-31",
        archiveUrl:
          "https://web.archive.org/web/20261031000000/https://docs.docker.com/reference/build-checks/legacy-key-value-format/",
        archivedAt: "2026-10-31",
      },
      {
        title: "Dockerfile reference: ENV",
        url: "https://docs.docker.com/reference/dockerfile/#env",
        accessedAt: "2026-10-31",
        archiveUrl: "https://web.archive.org/web/20261031000000/https://docs.docker.com/reference/dockerfile/#env",
        archivedAt: "2026-10-31",
      },
    ],
    provenance: {
      observedAt: "2026-10-31",
      reviewedAt: "2026-10-31",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
    migration: {
      constraints: ["Keep the variable name and its value unchanged.", "Use one key=value assignment per variable."],
      steps: [
        {
          id: "quote-legacy-env",
          title: "Write the variable as key=value",
          instructions: 'Replace ENV key value with ENV key="value", quoting the value when it contains spaces.',
          targets: "declaration",
        },
      ],
      verification: [
        { command: "docker build .", purpose: "Build the image with the rewritten Dockerfile." },
        { command: "docker run --rm IMAGE env", purpose: "Confirm the variable keeps its name and value." },
      ],
    },
  },
  {
    id: "container.host-ubuntu.eol-22.04-and-older",
    ecosystem: "container",
    purl: "pkg:generic/ubuntu",
    vers: "vers:semver/<22.0.0",
    event: "end-of-life",
    title: "Ubuntu releases before 22.04 LTS are past standard support",
    summary:
      "Ubuntu 20.04 LTS, the newest release this range covers, stopped receiving standard security updates on 2025-05-31; interim releases in the range ended earlier. Extended Security Maintenance is a separate paid subscription.",
    severity: "high",
    replacement: "An Ubuntu release in standard support, such as 24.04 LTS",
    replacements: [
      {
        purl: "pkg:generic/ubuntu",
        name: "Ubuntu 24.04 LTS",
        kind: "upgrade",
        vers: "vers:semver/>=24.4.0|<24.5.0",
        note: "Canonical lists standard security maintenance for Ubuntu 24.04 through May 2029. Follow the supported release upgrade sequence.",
      },
    ],
    deadline: "2025-05-31",
    sources: [
      {
        title: "Ubuntu release cycle",
        url: "https://ubuntu.com/about/release-cycle",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261030000000/https://ubuntu.com/about/release-cycle",
        archivedAt: "2026-10-30",
      },
    ],
    provenance: {
      observedAt: "2026-10-30",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Upgrade one release at a time, or rebuild the host on the target LTS and redeploy the workload.",
        "Extended Security Maintenance is a separate paid subscription; do not count it as standard support.",
      ],
      steps: [
        {
          id: "upgrade-host",
          title: "Upgrade the Ubuntu host",
          instructions:
            "Move the host to a supported Ubuntu LTS, confirm pinned packages and services, then drain and return it to service.",
          targets: "all",
        },
      ],
      verification: [
        { command: "lsb_release -a", purpose: "Confirm the host reports the target Ubuntu release." },
        { command: "apt-get -s upgrade", purpose: "Check that package upgrades resolve on the target release." },
      ],
    },
  },
  {
    id: "container.host-debian.eol-11-and-older",
    ecosystem: "container",
    purl: "pkg:generic/debian",
    vers: "vers:semver/<12.0.0",
    event: "end-of-life",
    title: "Debian 11 and older are end-of-life",
    summary:
      "Debian 11 reached the end of long-term support on 2026-08-31, and older releases ended earlier. These releases no longer receive security updates from the Debian project.",
    severity: "high",
    replacement: "Debian 12 or 13",
    replacements: [
      {
        purl: "pkg:generic/debian",
        name: "Debian 13",
        kind: "upgrade",
        vers: "vers:semver/>=13.0.0|<14.0.0",
        note: "Debian 13 is the stable release, with full support through 2028-08-09 and LTS through 2030-06-30. Follow the intermediate-release requirements.",
      },
    ],
    deadline: "2026-08-31",
    sources: [
      {
        title: "Debian releases",
        url: "https://www.debian.org/releases/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261030000000/https://www.debian.org/releases/",
        archivedAt: "2026-10-30",
      },
      {
        title: "Debian Long Term Support",
        url: "https://wiki.debian.org/LTS",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261030000000/https://wiki.debian.org/LTS",
        archivedAt: "2026-10-30",
      },
      {
        title: "Debian 13 lifecycle and release notes",
        url: "https://www.debian.org/releases/trixie/",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-30",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Follow the Debian release notes across every intermediate release; do not skip a major release.",
        "Confirm third-party repositories and held packages support the target release before upgrading.",
      ],
      steps: [
        {
          id: "upgrade-host",
          title: "Upgrade the Debian host",
          instructions:
            "Move the host to a supported Debian release with the documented upgrade procedure, or rebuild it and redeploy the workload.",
          targets: "all",
        },
      ],
      verification: [
        { command: "cat /etc/debian_version", purpose: "Confirm the host reports the target Debian release." },
        { command: "apt-get -s upgrade", purpose: "Check that package upgrades resolve on the target release." },
      ],
    },
  },
  {
    id: "container.host-rhel.eol-7-and-older",
    ecosystem: "container",
    purl: "pkg:generic/rhel",
    vers: "vers:semver/<8.0.0",
    event: "end-of-life",
    title: "Red Hat Enterprise Linux 7 and older are past maintenance support",
    summary:
      "RHEL 7 reached the end of its maintenance support phase on 2024-06-30, and older releases ended earlier. The Extended Life Cycle Support add-on is a separate paid subscription.",
    severity: "high",
    replacement: "RHEL 8, 9, or 10",
    replacements: [
      {
        purl: "pkg:generic/rhel",
        name: "RHEL 8.10",
        kind: "upgrade",
        vers: "vers:semver/>=8.10.0|<9.0.0",
        note: "RHEL 8 is in Maintenance Support. Check the subscription and the supported migration path before upgrading.",
      },
    ],
    deadline: "2024-06-30",
    sources: [
      {
        title: "Red Hat Enterprise Linux 7 end of maintenance",
        url: "https://www.redhat.com/en/technologies/linux-platforms/enterprise-linux/rhel-7-end-of-maintenance",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261030000000/https://www.redhat.com/en/technologies/linux-platforms/enterprise-linux/rhel-7-end-of-maintenance",
        archivedAt: "2026-10-30",
      },
      {
        title: "Red Hat product life cycles",
        url: "https://access.redhat.com/product-life-cycles",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261030000000/https://access.redhat.com/product-life-cycles",
        archivedAt: "2026-10-30",
      },
      {
        title: "Red Hat Enterprise Linux lifecycle",
        url: "https://access.redhat.com/support/policy/updates/errata",
        accessedAt: "2026-11-28",
      },
      {
        title: "RHEL 8.10 supported upgrade paths",
        url: "https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/8.10_release_notes/overview",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-10-30",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Use Leapp or the supported in-place upgrade path, or rebuild the host on the target major release.",
        "Extended Life Cycle Support is a separate paid subscription; do not count it as standard maintenance.",
      ],
      steps: [
        {
          id: "upgrade-host",
          title: "Upgrade the RHEL host",
          instructions:
            "Move the host to a supported RHEL major release, confirm subscriptions and third-party packages, then drain and return it to service.",
          targets: "all",
        },
      ],
      verification: [
        { command: "cat /etc/redhat-release", purpose: "Confirm the host reports the target RHEL release." },
        { command: "dnf check-update", purpose: "Check that package updates resolve on the target release." },
      ],
    },
  },
  {
    id: "container.host-centos.eol-8-and-older",
    ecosystem: "container",
    purl: "pkg:generic/centos",
    vers: "vers:semver/<9.0.0",
    event: "end-of-life",
    title: "CentOS Linux 8 and older are end-of-life",
    summary:
      "CentOS Linux 8 reached end of life on 2021-12-31 and CentOS Linux 7 on 2024-06-30, so neither receives fixes. CentOS Stream 9 and 10 follow a different lifecycle and are not covered by this rule.",
    severity: "high",
    replacement: "CentOS Stream 9 or 10, or a distribution with a published lifecycle",
    replacements: [
      {
        purl: "pkg:generic/centos-stream",
        name: "CentOS Stream 10",
        kind: "alternative",
        vers: "vers:semver/>=10.0.0|<11.0.0",
        note: "CentOS Stream is the replacement distribution developed by the CentOS project. Review workload migration and release policy.",
      },
    ],
    deadline: "2024-06-30",
    sources: [
      {
        title: "CentOS Linux",
        url: "https://www.centos.org/centos-linux/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261030000000/https://www.centos.org/centos-linux/",
        archivedAt: "2026-10-30",
      },
      { title: "CentOS Stream releases", url: "https://www.centos.org/centos-stream/", accessedAt: "2026-11-28" },
    ],
    provenance: {
      observedAt: "2026-10-30",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "CentOS Linux has no upgrade path to CentOS Stream; plan a rebuild or a migration to another distribution.",
        "Confirm application packages and repositories exist for the target platform before rebuilding.",
      ],
      steps: [
        {
          id: "upgrade-host",
          title: "Replace the CentOS host",
          instructions:
            "Rebuild the host on CentOS Stream or a distribution with a published lifecycle, then redeploy the workload.",
          targets: "all",
        },
      ],
      verification: [
        { command: "cat /etc/centos-release", purpose: "Confirm the host reports the target CentOS release." },
        { command: "dnf check-update", purpose: "Check that package updates resolve on the target release." },
      ],
    },
  },
  {
    id: "container.host-amazon-linux.eol-2-and-older",
    ecosystem: "container",
    purl: "pkg:generic/amzn",
    vers: "vers:semver/<2023.0.0",
    event: "end-of-life",
    title: "Amazon Linux 2 and the 2018.03 AMI are past end of support",
    summary:
      "Amazon Linux 2 reached the end of standard support on 2026-06-30, and Amazon Linux AMI 2018.03 ended support on 2023-12-31. Amazon Linux 2023 is supported until 2029-06-30.",
    severity: "high",
    replacement: "Amazon Linux 2023",
    replacements: [
      {
        purl: "pkg:generic/amzn",
        name: "Amazon Linux 2023",
        kind: "upgrade",
        vers: "vers:semver/>=2023.0.0|<2024.0.0",
        note: "AWS lists standard support through 2027-06-30 and maintenance through 2029-06-30. Review workload migration from AL2.",
      },
    ],
    deadline: "2026-06-30",
    sources: [
      {
        title: "Amazon Linux 2 release notes",
        url: "https://docs.aws.amazon.com/AL2/latest/relnotes/relnotes-al2.html",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261030000000/https://docs.aws.amazon.com/AL2/latest/relnotes/relnotes-al2.html",
        archivedAt: "2026-10-30",
      },
      {
        title: "Amazon Linux 2023 release cadence",
        url: "https://docs.aws.amazon.com/linux/al2023/ug/release-cadence.html",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261030000000/https://docs.aws.amazon.com/linux/al2023/ug/release-cadence.html",
        archivedAt: "2026-10-30",
      },
    ],
    provenance: {
      observedAt: "2026-10-30",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Amazon Linux 2023 is a separate major release: rebuild the host rather than upgrading in place.",
        "Confirm installed packages and agents are available for Amazon Linux 2023 before switching.",
      ],
      steps: [
        {
          id: "upgrade-host",
          title: "Replace the Amazon Linux host",
          instructions:
            "Launch a replacement host on Amazon Linux 2023 from the same configuration, then move traffic to it.",
          targets: "all",
        },
      ],
      verification: [
        { command: "cat /etc/system-release", purpose: "Confirm the host reports Amazon Linux 2023." },
        { command: "dnf check-update", purpose: "Check that package updates resolve on the new host." },
      ],
    },
  },
  {
    id: "container.host-alpine.eol-3.20-and-older",
    ecosystem: "container",
    purl: "pkg:generic/alpine",
    vers: "vers:semver/<3.21.0",
    event: "end-of-life",
    title: "Alpine Linux 3.20 and older are end-of-life",
    summary:
      "Alpine Linux 3.20, the newest release this range covers, stopped receiving security updates on 2026-04-01; older release branches ended earlier. Each branch is supported for about two years.",
    severity: "high",
    replacement: "Alpine Linux 3.21 or later",
    replacements: [
      {
        purl: "pkg:generic/alpine",
        name: "Alpine Linux 3.22",
        kind: "upgrade",
        vers: "vers:semver/>=3.22.0|<3.23.0",
        note: "The Alpine release schedule lists support for the main repository through 2027-05-01. Check each installed package repository.",
      },
    ],
    deadline: "2026-04-01",
    sources: [
      {
        title: "Alpine Linux releases",
        url: "https://alpinelinux.org/releases/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261030000000/https://alpinelinux.org/releases/",
        archivedAt: "2026-10-30",
      },
    ],
    provenance: {
      observedAt: "2026-10-30",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Upgrade one Alpine branch at a time and reinstall packages from the target repositories.",
        "Confirm services and pinned packages have builds for the target branch.",
      ],
      steps: [
        {
          id: "upgrade-host",
          title: "Upgrade the Alpine host",
          instructions:
            "Move the host to a supported Alpine branch with the documented upgrade procedure, or rebuild it and redeploy the workload.",
          targets: "all",
        },
      ],
      verification: [
        { command: "cat /etc/alpine-release", purpose: "Confirm the host reports the target Alpine branch." },
        { command: "apk update", purpose: "Check that the target repositories are reachable and current." },
      ],
    },
  },
  {
    id: "container.host-sles.eol-15-sp6-and-older",
    ecosystem: "container",
    purl: "pkg:generic/sles",
    vers: "vers:semver/<15.7.0",
    event: "end-of-life",
    title: "SUSE Linux Enterprise Server 15 SP6 and older are past general support",
    summary:
      "General support ended for SLES 15 SP6 on 2025-12-31, SP5 on 2024-12-31, and SP4 on 2023-12-31, and for SP3 and older earlier. Long Term Service Pack Support is a separate paid add-on; SLES 15 SP7 and SLES 16 remain in general support.",
    severity: "high",
    replacement: "SLES 15 SP7 or SLES 16",
    replacements: [
      {
        purl: "pkg:generic/sles",
        name: "SLES 15 SP7",
        kind: "upgrade",
        vers: "vers:semver/>=15.7.0|<16.0.0",
        note: "SUSE names 15 SP7 as the successor service pack and lists it in general support through July 2031.",
      },
    ],
    deadline: "2025-12-31",
    sources: [
      {
        title: "SUSE product support lifecycle",
        url: "https://www.suse.com/lifecycle/",
        accessedAt: "2026-11-28",
        archiveUrl: "https://web.archive.org/web/20261030000000/https://www.suse.com/lifecycle/",
        archivedAt: "2026-10-30",
      },
      {
        title: "SLES 15 SP6 lifecycle and support",
        url: "https://documentation.suse.com/sles/15-SP6/html/SLES-all/cha-upgrade-background.html",
        accessedAt: "2026-11-28",
        archiveUrl:
          "https://web.archive.org/web/20261030000000/https://documentation.suse.com/sles/15-SP6/html/SLES-all/cha-upgrade-background.html",
        archivedAt: "2026-10-30",
      },
    ],
    provenance: {
      observedAt: "2026-10-30",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "imported",
      importer: "endoflife-date",
    },
    migration: {
      constraints: [
        "Use the supported service-pack migration path, or rebuild the host on the target service pack.",
        "Long Term Service Pack Support is a separate paid add-on; do not count it as general support.",
      ],
      steps: [
        {
          id: "upgrade-host",
          title: "Upgrade the SLES host",
          instructions:
            "Move the host to a supported SLES service pack, confirm subscriptions and third-party packages, then return it to service.",
          targets: "all",
        },
      ],
      verification: [
        { command: "cat /etc/os-release", purpose: "Confirm the host reports the target SLES service pack." },
        { command: "zypper refresh", purpose: "Check that the target repositories are configured and reachable." },
      ],
    },
  },
  {
    id: "container.ubuntu.extended-support-14.04",
    ecosystem: "container",
    purl: "pkg:docker/library/ubuntu",
    vers: "vers:semver/>=14.0.0|<14.10.0",
    event: "end-of-extended-support",
    title: "Ubuntu image release line 14.04 reached extended support end-of-life on 2029-05-31",
    summary: "Ubuntu 14.04 LTS receives Legacy add-on coverage through May 2029 via Ubuntu Pro.",
    severity: "high",
    replacement: "An ubuntu image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/ubuntu",
        name: "ubuntu:26.04",
        kind: "upgrade",
        vers: "vers:semver/>=26.4.0|<26.5.0",
        note: "Canonical lists standard security maintenance for Ubuntu 26.04 through May 2031. Rebuild on an official 26.04 image.",
      },
    ],
    deadline: "2029-05-31",
    sources: [
      { title: "Ubuntu release cycle", url: "https://ubuntu.com/about/release-cycle", accessedAt: "2026-11-28" },
      {
        title: "Docker Official Image tags for Ubuntu",
        url: "https://github.com/docker-library/official-images/blob/master/library/ubuntu",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
  },
  {
    id: "container.ubuntu.extended-support-16.04",
    ecosystem: "container",
    purl: "pkg:docker/library/ubuntu",
    vers: "vers:semver/>=16.0.0|<16.10.0",
    event: "end-of-extended-support",
    title: "Ubuntu image release line 16.04 reaches extended support end-of-life on 2031-05-31",
    summary:
      "Ubuntu 16.04 LTS receives Extended Security Maintenance through May 2026 and Legacy add-on coverage through May 2031 via Ubuntu Pro.",
    severity: "medium",
    replacement: "An ubuntu image on a supported release line",
    deadline: "2031-05-31",
    sources: [
      { title: "Ubuntu release cycle", url: "https://ubuntu.com/about/release-cycle", accessedAt: "2026-11-27" },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  },
  {
    id: "container.ubuntu.extended-support-18.04",
    ecosystem: "container",
    purl: "pkg:docker/library/ubuntu",
    vers: "vers:semver/>=18.0.0|<18.10.0",
    event: "end-of-extended-support",
    title: "Ubuntu image release line 18.04 reaches extended support end-of-life on 2033-05-31",
    summary:
      "Ubuntu 18.04 LTS receives Extended Security Maintenance through May 2028 and Legacy add-on coverage through May 2033 via Ubuntu Pro.",
    severity: "medium",
    replacement: "An ubuntu image on a supported release line",
    deadline: "2033-05-31",
    sources: [
      { title: "Ubuntu release cycle", url: "https://ubuntu.com/about/release-cycle", accessedAt: "2026-11-27" },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  },
  {
    id: "container.ubuntu.extended-support-20.04",
    ecosystem: "container",
    purl: "pkg:docker/library/ubuntu",
    vers: "vers:semver/>=20.0.0|<20.10.0",
    event: "end-of-extended-support",
    title: "Ubuntu image release line 20.04 reaches extended support end-of-life on 2035-05-31",
    summary:
      "Ubuntu 20.04 LTS receives Extended Security Maintenance through May 2030 and Legacy add-on coverage through May 2035 via Ubuntu Pro.",
    severity: "medium",
    replacement: "An ubuntu image on a supported release line",
    deadline: "2035-05-31",
    sources: [
      { title: "Ubuntu release cycle", url: "https://ubuntu.com/about/release-cycle", accessedAt: "2026-11-27" },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  },
  {
    id: "container.ubuntu.extended-support-22.04",
    ecosystem: "container",
    purl: "pkg:docker/library/ubuntu",
    vers: "vers:semver/>=22.0.0|<22.10.0",
    event: "end-of-extended-support",
    title: "Ubuntu image release line 22.04 reaches extended support end-of-life on 2037-05-31",
    summary:
      "Ubuntu 22.04 LTS receives Extended Security Maintenance through May 2032 and Legacy add-on coverage through May 2037 via Ubuntu Pro.",
    severity: "low",
    replacement: "An ubuntu image on a later supported release line",
    deadline: "2037-05-31",
    sources: [
      { title: "Ubuntu release cycle", url: "https://ubuntu.com/about/release-cycle", accessedAt: "2026-11-27" },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  },
  {
    id: "container.ubuntu.extended-support-24.04",
    ecosystem: "container",
    purl: "pkg:docker/library/ubuntu",
    vers: "vers:semver/>=24.0.0|<24.10.0",
    event: "end-of-extended-support",
    title: "Ubuntu image release line 24.04 reaches extended support end-of-life on 2039-05-31",
    summary:
      "Ubuntu 24.04 LTS receives Extended Security Maintenance through May 2034 and Legacy add-on coverage through May 2039 via Ubuntu Pro.",
    severity: "low",
    replacement: "An ubuntu image on a later supported release line",
    deadline: "2039-05-31",
    sources: [
      { title: "Ubuntu release cycle", url: "https://ubuntu.com/about/release-cycle", accessedAt: "2026-11-27" },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  },
  {
    id: "container.host-ubuntu.extended-support-20.04",
    ecosystem: "container",
    purl: "pkg:generic/ubuntu",
    vers: "vers:semver/>=20.0.0|<20.10.0",
    event: "end-of-extended-support",
    title: "Ubuntu 20.04 LTS extended support ends on 2035-05-31",
    summary:
      "Ubuntu 20.04 LTS receives Extended Security Maintenance through May 2030 and Legacy add-on coverage through May 2035 via Ubuntu Pro.",
    severity: "medium",
    replacement: "An Ubuntu release in standard support, such as 24.04 LTS",
    deadline: "2035-05-31",
    sources: [
      { title: "Ubuntu release cycle", url: "https://ubuntu.com/about/release-cycle", accessedAt: "2026-11-27" },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  },
  {
    id: "container.host-ubuntu.extended-support-22.04",
    ecosystem: "container",
    purl: "pkg:generic/ubuntu",
    vers: "vers:semver/>=22.0.0|<22.10.0",
    event: "end-of-extended-support",
    title: "Ubuntu 22.04 LTS extended support ends on 2037-05-31",
    summary:
      "Ubuntu 22.04 LTS receives Extended Security Maintenance through May 2032 and Legacy add-on coverage through May 2037 via Ubuntu Pro.",
    severity: "low",
    replacement: "An Ubuntu release in standard support, such as 24.04 LTS",
    deadline: "2037-05-31",
    sources: [
      { title: "Ubuntu release cycle", url: "https://ubuntu.com/about/release-cycle", accessedAt: "2026-11-27" },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  },
  {
    id: "container.host-rhel.extended-support-7",
    ecosystem: "container",
    purl: "pkg:generic/rhel",
    vers: "vers:semver/>=7.0.0|<8.0.0",
    event: "end-of-extended-support",
    title: "Red Hat Enterprise Linux 7 Extended Life Cycle Support ends on 2029-05-31",
    summary: "RHEL 7 Extended Life Cycle Support (ELS) add-on provides security maintenance through 2029-05-31.",
    severity: "medium",
    replacement: "RHEL 8, 9, or 10",
    replacements: [
      {
        purl: "pkg:generic/rhel",
        name: "RHEL 9",
        kind: "upgrade",
        vers: "vers:semver/>=9.0.0|<10.0.0",
        note: "RHEL 9 remains in regular maintenance beyond the end of RHEL 7 ELS. Check supported minor releases and the migration path.",
      },
    ],
    deadline: "2029-05-31",
    sources: [
      {
        title: "Red Hat product life cycles",
        url: "https://access.redhat.com/support/policy/updates/errata",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
  },
  {
    id: "container.debian.extended-support-10",
    ecosystem: "container",
    purl: "pkg:docker/library/debian",
    vers: "vers:semver/>=10.0.0|<11.0.0",
    event: "end-of-extended-support",
    title: "Debian image release line 10 Extended Long Term Support ends on 2029-06-30",
    summary:
      "Debian 10 Extended Long Term Support (ELTS) is a commercial offering by Freexian endorsed on the Debian wiki, extending security coverage through 2029-06-30.",
    severity: "medium",
    confidence: "tentative",
    confidenceNote:
      "ELTS is a commercial offering provided by Freexian in coordination with Debian, documented on wiki.debian.org/LTS/Extended rather than an official project release.",
    replacement: "A debian image on a supported release line",
    replacements: [
      {
        purl: "pkg:docker/library/debian",
        name: "debian:13",
        kind: "upgrade",
        vers: "vers:semver/>=13.0.0|<14.0.0",
        note: "Debian lists project-supported LTS through 2030-06-30. Rebuild on an official Debian 13 image for your architecture.",
      },
    ],
    deadline: "2029-06-30",
    sources: [
      { title: "Debian Extended LTS", url: "https://wiki.debian.org/LTS/Extended", accessedAt: "2026-11-28" },
      {
        title: "Debian 13 lifecycle and release notes",
        url: "https://www.debian.org/releases/trixie/",
        accessedAt: "2026-11-28",
      },
      {
        title: "Docker Official Image tags for Debian",
        url: "https://github.com/docker-library/official-images/blob/master/library/debian",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
  },
  {
    id: "container.debian.extended-support-11",
    ecosystem: "container",
    purl: "pkg:docker/library/debian",
    vers: "vers:semver/>=11.0.0|<12.0.0",
    event: "end-of-extended-support",
    title: "Debian image release line 11 Extended Long Term Support ends on 2031-06-30",
    summary:
      "Debian 11 Extended Long Term Support (ELTS) is a commercial offering by Freexian endorsed on the Debian wiki, extending security coverage through 2031-06-30.",
    severity: "low",
    confidence: "tentative",
    confidenceNote:
      "ELTS is a commercial offering provided by Freexian in coordination with Debian, documented on wiki.debian.org/LTS/Extended rather than an official project release.",
    replacement: "A debian image on a supported release line",
    deadline: "2031-06-30",
    sources: [{ title: "Debian Extended LTS", url: "https://wiki.debian.org/LTS/Extended", accessedAt: "2026-11-27" }],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  },
  {
    id: "container.host-debian.extended-support-11",
    ecosystem: "container",
    purl: "pkg:generic/debian",
    vers: "vers:semver/>=11.0.0|<12.0.0",
    event: "end-of-extended-support",
    title: "Debian 11 Extended Long Term Support ends on 2031-06-30",
    summary:
      "Debian 11 Extended Long Term Support (ELTS) is a commercial offering by Freexian endorsed on the Debian wiki, extending security coverage through 2031-06-30.",
    severity: "low",
    confidence: "tentative",
    confidenceNote:
      "ELTS is a commercial offering provided by Freexian in coordination with Debian, documented on wiki.debian.org/LTS/Extended rather than an official project release.",
    replacement: "Debian 12 or 13",
    deadline: "2031-06-30",
    sources: [{ title: "Debian Extended LTS", url: "https://wiki.debian.org/LTS/Extended", accessedAt: "2026-11-27" }],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  },
  {
    id: "container.host-debian.extended-support-10",
    ecosystem: "container",
    purl: "pkg:generic/debian",
    vers: "vers:semver/>=10.0.0|<11.0.0",
    event: "end-of-extended-support",
    title: "Debian 10 Extended Long Term Support ends on 2029-06-30",
    summary:
      "Debian 10 Extended Long Term Support (ELTS) is a commercial offering by Freexian endorsed on the Debian wiki, extending security coverage through 2029-06-30.",
    severity: "medium",
    confidence: "tentative",
    confidenceNote:
      "ELTS is a commercial offering provided by Freexian in coordination with Debian, documented on wiki.debian.org/LTS/Extended rather than an official project release.",
    replacement: "Debian 12 or 13",
    replacements: [
      {
        purl: "pkg:generic/debian",
        name: "Debian 13",
        kind: "upgrade",
        vers: "vers:semver/>=13.0.0|<14.0.0",
        note: "Debian 13 is the stable release, with full support through 2028-08-09 and LTS through 2030-06-30. Follow the intermediate-release requirements.",
      },
    ],
    deadline: "2029-06-30",
    sources: [
      { title: "Debian Extended LTS", url: "https://wiki.debian.org/LTS/Extended", accessedAt: "2026-11-28" },
      {
        title: "Debian 13 lifecycle and release notes",
        url: "https://www.debian.org/releases/trixie/",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-28",
      reviewer: "codex-agent",
      reviewers: ["arminazimi", "codex-agent"],
      method: "manual",
    },
  },
] as const;

export const data: RegistryV2 = {
  schemaVersion: "ebb.registry.v2",
  ecosystem: "container",

  rules: [...rules],
};

export default rules;
