// Generated file - do not edit directly. Run npm run build:ecosystems.
import type { RegistryV2, RegistryV2Rule } from "../../registry.js";

export const ecosystem = "infrastructure" as const;

export const rules: readonly RegistryV2Rule[] = [
  {
    id: "infrastructure.helm.end-of-active-support-2",
    ecosystem: "infrastructure",
    purl: "pkg:generic/helm",
    vers: "vers:semver/>=2.0.0|<3.0.0-0",
    event: "end-of-active-support",
    title: "Helm 2 regular bug fixes ended",
    summary:
      "The Helm project ended regular bug-fix support for Helm 2 on 2020-08-13. Security fixes continued on a separate schedule.",
    severity: "medium",
    confidence: "likely",
    sources: [
      {
        title: "Helm v2 Deprecation Timeline",
        url: "https://docs.helm.sh/blog/helm-v2-deprecation-timeline/",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2020-08-13",
    replacement: "Follow the Helm upgrade documentation to move to a maintained release.",
  },
  {
    id: "infrastructure.helm.eol-2",
    ecosystem: "infrastructure",
    purl: "pkg:generic/helm",
    vers: "vers:semver/>=2.0.0|<3.0.0-0",
    event: "end-of-support",
    title: "Helm 2 security support ended",
    summary: "The Helm project ended security fixes for Helm 2 on 2020-11-13.",
    severity: "high",
    confidence: "likely",
    sources: [
      {
        title: "Helm 2 and the Charts Project Are Now Unsupported",
        url: "https://helm.sh/blog/helm-2-becomes-unsupported/",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2020-11-13",
    replacement: "Follow the Helm upgrade documentation to move to a maintained release.",
  },
  {
    id: "infrastructure.helm.end-of-active-support-3",
    ecosystem: "infrastructure",
    purl: "pkg:generic/helm",
    vers: "vers:semver/>=3.0.0|<4.0.0-0",
    event: "end-of-active-support",
    title: "Helm 3 regular bug fixes ended",
    summary:
      "The Helm project ended regular bug-fix support for Helm 3 on 2026-09-09. Security fixes continued on a separate schedule.",
    severity: "medium",
    confidence: "likely",
    sources: [
      { title: "Helm 3 End of Life", url: "https://docs.helm.sh/blog/helm-v3-end-of-life/", accessedAt: "2026-11-28" },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2026-09-09",
    replacement: "Follow the Helm upgrade documentation to move to a maintained release.",
  },
  {
    id: "infrastructure.helm.eol-3",
    ecosystem: "infrastructure",
    purl: "pkg:generic/helm",
    vers: "vers:semver/>=3.0.0|<4.0.0-0",
    event: "scheduled-end-of-life",
    title: "Helm 3 security support ends",
    summary: "The Helm project will end security fixes for Helm 3 on 2027-02-10.",
    severity: "low",
    confidence: "likely",
    sources: [
      { title: "Helm 3 End of Life", url: "https://docs.helm.sh/blog/helm-v3-end-of-life/", accessedAt: "2026-11-28" },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2027-02-10",
    replacement: "Follow the Helm upgrade documentation to move to a maintained release.",
  },
  {
    id: "infrastructure.odoo-enterprise.end-of-standard-support-15",
    ecosystem: "infrastructure",
    purl: "pkg:generic/odoo-enterprise",
    vers: "vers:semver/>=15.0.0|<16.0.0-0",
    event: "end-of-support",
    title: "Odoo Enterprise 15.0 standard support ended",
    summary:
      "Odoo lists October 2024 as the end of standard support for major release 15.0. Additional-fee extended support is a separate service.",
    severity: "high",
    confidence: "likely",
    sources: [
      {
        title: "Odoo standard and extended support",
        url: "https://www.odoo.com/documentation/18.0/administration/supported_versions.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2024-10-31",
    "x-infrastructure": { endOfLifeMonth: "2024-10" },
  },
  {
    id: "infrastructure.odoo-enterprise.end-of-standard-support-16",
    ecosystem: "infrastructure",
    purl: "pkg:generic/odoo-enterprise",
    vers: "vers:semver/>=16.0.0|<17.0.0-0",
    event: "end-of-support",
    title: "Odoo Enterprise 16.0 standard support ended",
    summary:
      "Odoo lists September 2025 as the end of standard support for major release 16.0. Additional-fee extended support is a separate service.",
    severity: "high",
    confidence: "likely",
    sources: [
      {
        title: "Odoo standard and extended support",
        url: "https://www.odoo.com/documentation/18.0/administration/supported_versions.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2025-09-30",
    "x-infrastructure": { endOfLifeMonth: "2025-09" },
  },
  {
    id: "infrastructure.odoo-enterprise.end-of-standard-support-17",
    ecosystem: "infrastructure",
    purl: "pkg:generic/odoo-enterprise",
    vers: "vers:semver/>=17.0.0|<18.0.0-0",
    event: "end-of-support",
    title: "Odoo Enterprise 17.0 standard support ended",
    summary:
      "Odoo lists September 2026 as the end of standard support for major release 17.0. Additional-fee extended support is a separate service.",
    severity: "high",
    confidence: "likely",
    sources: [
      {
        title: "Odoo standard and extended support",
        url: "https://www.odoo.com/documentation/18.0/administration/supported_versions.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2026-09-30",
    "x-infrastructure": { endOfLifeMonth: "2026-09" },
  },
  {
    id: "infrastructure.odoo-enterprise.end-of-standard-support-before-15",
    ecosystem: "infrastructure",
    purl: "pkg:generic/odoo-enterprise",
    vers: "vers:semver/<15.0.0-0",
    event: "end-of-support",
    title: "Odoo Enterprise versions before 15.0 are outside standard support",
    summary:
      "Odoo groups major releases older than 15.0 together and lists them as outside standard support. The support table provides a broad cutoff rather than a date per release.",
    severity: "high",
    confidence: "likely",
    sources: [
      {
        title: "Odoo standard and extended support",
        url: "https://www.odoo.com/documentation/18.0/administration/supported_versions.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
  },
  {
    id: "infrastructure.odoo.end-of-security-support-through-15",
    ecosystem: "infrastructure",
    purl: "pkg:generic/odoo",
    vers: "vers:semver/<16.0.0-0",
    event: "end-of-support",
    title: "Odoo Community 15.0 and older are outside upstream security support",
    summary:
      "The public Odoo source repository lists 15.0 and older as unsupported under its security policy. The policy gives no support-end dates.",
    severity: "high",
    confidence: "likely",
    sources: [
      {
        title: "Odoo source repository security policy",
        url: "https://github.com/odoo/odoo/security/policy",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
  },
  {
    id: "infrastructure.linux.lts-eol-5.10",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux",
    vers: "vers:semver/>=5.10.0|<5.11.0-0",
    event: "scheduled-end-of-life",
    title: "Upstream Linux 5.10 LTS projected end of life",
    summary:
      "Kernel.org projects end of life for its upstream Linux 5.10 LTS line in December 2026. The project may extend this schedule.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "The Linux Kernel Archives: Active kernel releases",
        url: "https://www.kernel.org/releases.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2026-12-31",
    "x-infrastructure": { endOfLifeMonth: "2026-12" },
  },
  {
    id: "infrastructure.linux.lts-eol-5.15",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux",
    vers: "vers:semver/>=5.15.0|<5.16.0-0",
    event: "scheduled-end-of-life",
    title: "Upstream Linux 5.15 LTS projected end of life",
    summary:
      "Kernel.org projects end of life for its upstream Linux 5.15 LTS line in December 2026. The project may extend this schedule.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "The Linux Kernel Archives: Active kernel releases",
        url: "https://www.kernel.org/releases.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2026-12-31",
    "x-infrastructure": { endOfLifeMonth: "2026-12" },
  },
  {
    id: "infrastructure.linux.lts-eol-6.1",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux",
    vers: "vers:semver/>=6.1.0|<6.2.0-0",
    event: "scheduled-end-of-life",
    title: "Upstream Linux 6.1 LTS projected end of life",
    summary:
      "Kernel.org projects end of life for its upstream Linux 6.1 LTS line in December 2027. The project may extend this schedule.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "The Linux Kernel Archives: Active kernel releases",
        url: "https://www.kernel.org/releases.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2027-12-31",
    "x-infrastructure": { endOfLifeMonth: "2027-12" },
  },
  {
    id: "infrastructure.linux.lts-eol-6.6",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux",
    vers: "vers:semver/>=6.6.0|<6.7.0-0",
    event: "scheduled-end-of-life",
    title: "Upstream Linux 6.6 LTS projected end of life",
    summary:
      "Kernel.org projects end of life for its upstream Linux 6.6 LTS line in December 2027. The project may extend this schedule.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "The Linux Kernel Archives: Active kernel releases",
        url: "https://www.kernel.org/releases.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2027-12-31",
    "x-infrastructure": { endOfLifeMonth: "2027-12" },
  },
  {
    id: "infrastructure.linux.lts-eol-6.12",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux",
    vers: "vers:semver/>=6.12.0|<6.13.0-0",
    event: "scheduled-end-of-life",
    title: "Upstream Linux 6.12 LTS projected end of life",
    summary:
      "Kernel.org projects end of life for its upstream Linux 6.12 LTS line in December 2028. The project may extend this schedule.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "The Linux Kernel Archives: Active kernel releases",
        url: "https://www.kernel.org/releases.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2028-12-31",
    "x-infrastructure": { endOfLifeMonth: "2028-12" },
  },
  {
    id: "infrastructure.linux.lts-eol-6.18",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux",
    vers: "vers:semver/>=6.18.0|<6.19.0-0",
    event: "scheduled-end-of-life",
    title: "Upstream Linux 6.18 LTS projected end of life",
    summary:
      "Kernel.org projects end of life for its upstream Linux 6.18 LTS line in December 2028. The project may extend this schedule.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "The Linux Kernel Archives: Active kernel releases",
        url: "https://www.kernel.org/releases.html",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2028-12-31",
    "x-infrastructure": { endOfLifeMonth: "2028-12" },
  },
  {
    id: "infrastructure.linux-cip.slts-eol-4.4",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux-cip",
    vers: "vers:semver/>=4.4.0-0|<4.5.0-0",
    event: "scheduled-end-of-life",
    title: "CIP Linux 4.4 SLTS projected end of life",
    summary:
      "The Civil Infrastructure Platform projects end of its 4.4 SLTS line in January 2027. This schedule covers the corresponding CIP build and its real-time variant when listed by CIP.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "Civil Infrastructure Platform: Kernel maintainership",
        url: "https://wiki.linuxfoundation.org/civilinfrastructureplatform/start#kernel_maintainership",
        accessedAt: "2026-11-28",
      },
      {
        title: "Civil Infrastructure Platform: CIP kernel schedule",
        url: "https://gitlab.com/cip-project/cip-lifecycle/-/raw/master/cip-kernel.yml",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2027-01-31",
    "x-infrastructure": { endOfLifeMonth: "2027-01" },
  },
  {
    id: "infrastructure.linux-cip.slts-eol-4.19",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux-cip",
    vers: "vers:semver/>=4.19.0-0|<4.20.0-0",
    event: "scheduled-end-of-life",
    title: "CIP Linux 4.19 SLTS projected end of life",
    summary:
      "The Civil Infrastructure Platform projects end of its 4.19 SLTS line in January 2029. This schedule covers the corresponding CIP build and its real-time variant when listed by CIP.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "Civil Infrastructure Platform: Kernel maintainership",
        url: "https://wiki.linuxfoundation.org/civilinfrastructureplatform/start#kernel_maintainership",
        accessedAt: "2026-11-28",
      },
      {
        title: "Civil Infrastructure Platform: CIP kernel schedule",
        url: "https://gitlab.com/cip-project/cip-lifecycle/-/raw/master/cip-kernel.yml",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2029-01-31",
    "x-infrastructure": { endOfLifeMonth: "2029-01" },
  },
  {
    id: "infrastructure.linux-cip.slts-eol-5.10",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux-cip",
    vers: "vers:semver/>=5.10.0-0|<5.11.0-0",
    event: "scheduled-end-of-life",
    title: "CIP Linux 5.10 SLTS projected end of life",
    summary:
      "The Civil Infrastructure Platform projects end of its 5.10 SLTS line in January 2031. This schedule covers the corresponding CIP build and its real-time variant when listed by CIP.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "Civil Infrastructure Platform: Kernel maintainership",
        url: "https://wiki.linuxfoundation.org/civilinfrastructureplatform/start#kernel_maintainership",
        accessedAt: "2026-11-28",
      },
      {
        title: "Civil Infrastructure Platform: CIP kernel schedule",
        url: "https://gitlab.com/cip-project/cip-lifecycle/-/raw/master/cip-kernel.yml",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2031-01-31",
    "x-infrastructure": { endOfLifeMonth: "2031-01" },
  },
  {
    id: "infrastructure.linux-cip.slts-eol-6.1",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux-cip",
    vers: "vers:semver/>=6.1.0-0|<6.2.0-0",
    event: "scheduled-end-of-life",
    title: "CIP Linux 6.1 SLTS projected end of life",
    summary:
      "The Civil Infrastructure Platform projects end of its 6.1 SLTS line in August 2033. This schedule covers the corresponding CIP build and its real-time variant when listed by CIP.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "Civil Infrastructure Platform: Kernel maintainership",
        url: "https://wiki.linuxfoundation.org/civilinfrastructureplatform/start#kernel_maintainership",
        accessedAt: "2026-11-28",
      },
      {
        title: "Civil Infrastructure Platform: CIP kernel schedule",
        url: "https://gitlab.com/cip-project/cip-lifecycle/-/raw/master/cip-kernel.yml",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2033-08-31",
    "x-infrastructure": { endOfLifeMonth: "2033-08" },
  },
  {
    id: "infrastructure.linux-cip.slts-eol-6.12",
    ecosystem: "infrastructure",
    purl: "pkg:generic/linux-cip",
    vers: "vers:semver/>=6.12.0-0|<6.13.0-0",
    event: "scheduled-end-of-life",
    title: "CIP Linux 6.12 SLTS projected end of life",
    summary:
      "The Civil Infrastructure Platform projects end of its 6.12 SLTS line in June 2035. This schedule covers the corresponding CIP build and its real-time variant when listed by CIP.",
    severity: "low",
    confidence: "likely",
    sources: [
      {
        title: "Civil Infrastructure Platform: Kernel maintainership",
        url: "https://wiki.linuxfoundation.org/civilinfrastructureplatform/start#kernel_maintainership",
        accessedAt: "2026-11-28",
      },
      {
        title: "Civil Infrastructure Platform: CIP kernel schedule",
        url: "https://gitlab.com/cip-project/cip-lifecycle/-/raw/master/cip-kernel.yml",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2035-06-30",
    "x-infrastructure": { endOfLifeMonth: "2035-06" },
  },
  {
    id: "infrastructure.minio.end-of-active-support",
    ecosystem: "infrastructure",
    purl: "pkg:generic/minio",
    vers: "vers:semver/*",
    event: "end-of-active-support",
    title: "MinIO Community Edition entered maintenance mode",
    summary:
      "MinIO announced maintenance-only development for the Community Edition on 2025-12-03. The announcement allows review of critical security fixes case by case.",
    severity: "medium",
    confidence: "likely",
    sources: [
      {
        title: "MinIO Community Edition maintenance announcement",
        url: "https://github.com/minio/minio/commit/27742d469462e1561c776f88ca7a1f26816d69e2",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
    deadline: "2025-12-03",
  },
  {
    id: "infrastructure.minio-community-binary.end-of-support",
    ecosystem: "infrastructure",
    purl: "pkg:generic/minio-community-binary",
    vers: "vers:semver/*",
    event: "end-of-support",
    title: "MinIO Community Edition legacy binaries no longer receive updates",
    summary:
      "MinIO says historical precompiled Community Edition releases remain available for reference and no longer receive updates. Its statement gives no binary support cutoff date.",
    severity: "high",
    confidence: "likely",
    sources: [
      {
        title: "MinIO Community Edition: Legacy binary releases",
        url: "https://github.com/minio/minio/blob/master/README.md#legacy-binary-releases",
        accessedAt: "2026-11-28",
      },
      {
        title: "MinIO Community Edition binary release example",
        url: "https://github.com/minio/minio/releases/tag/RELEASE.2025-09-07T16-13-09Z",
        accessedAt: "2026-11-28",
      },
    ],
    provenance: { observedAt: "2026-11-28", reviewedAt: "2026-11-28", reviewer: "unreviewed", method: "manual" },
  },
] as const;

export const data: RegistryV2 = {
  schemaVersion: "ebb.registry.v2",
  ecosystem: "infrastructure",

  rules: [...rules],
};

export default rules;
