// Generated file - do not edit directly. Run npm run build:ecosystems.
import type { RegistryV2, RegistryV2Rule } from "../../registry.js";

export const ecosystem = "github-actions" as const;

export const rules: readonly RegistryV2Rule[] = [
  {
    id: "github-actions.add-to-project.node16",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/add-to-project",
    vers: "vers:semver/>=0.0.1|<0.6.0",
    event: "end-of-support",
    title: "Unsupported actions/add-to-project Node.js 16 runtime",
    summary:
      "Versions 0.0.1 through 0.5.0 declare Node.js 16. GitHub removed that runtime from Actions runners on 2024-11-12.",
    severity: "high",
    replacement: "actions/add-to-project@v2 or later",
    deadline: "2024-11-12",
    sources: [
      {
        title: "End of life for Actions Node16",
        url: "https://github.blog/changelog/2024-09-25-end-of-life-for-actions-node16/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/add-to-project v0.0.1 action manifest",
        url: "https://github.com/actions/add-to-project/blob/v0.0.1/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/add-to-project v0.5.0 action manifest",
        url: "https://github.com/actions/add-to-project/blob/v0.5.0/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/add-to-project v0.6.0 action manifest",
        url: "https://github.com/actions/add-to-project/blob/v0.6.0/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/add-to-project v2.0.0 action manifest",
        url: "https://github.com/actions/add-to-project/blob/v2.0.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
  },
  {
    id: "github-actions.add-to-project.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/add-to-project",
    vers: "vers:semver/>=0.6.0|<2.0.0",
    event: "end-of-support",
    title: "Unsupported actions/add-to-project Node.js 20 runtime",
    summary:
      "The published 0.6.x and 1.x releases declare Node.js 20. GitHub removed that runtime from Actions runners on 2026-09-23.",
    severity: "high",
    replacement: "actions/add-to-project@v2 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/add-to-project v0.6.0 action manifest",
        url: "https://github.com/actions/add-to-project/blob/v0.6.0/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/add-to-project v1.0.0 action manifest",
        url: "https://github.com/actions/add-to-project/blob/v1.0.0/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/add-to-project v1.0.2 action manifest",
        url: "https://github.com/actions/add-to-project/blob/v1.0.2/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/add-to-project v2.0.0 action manifest",
        url: "https://github.com/actions/add-to-project/blob/v2.0.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
  },
  {
    id: "github-actions.publish-action.node12",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/publish-action",
    vers: "vers:semver/0.1.0",
    event: "end-of-support",
    title: "Unsupported actions/publish-action Node.js 12 runtime",
    summary: "Version 0.1.0 declare Node.js 12. GitHub removed that runtime from Actions runners on 2023-08-14.",
    severity: "high",
    deadline: "2023-08-14",
    sources: [
      {
        title: "Removal of Node12 from the Actions runner",
        url: "https://github.blog/changelog/2023-07-16-github-actions-removal-of-node12-from-the-actions-runner/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-action v0.1.0 action manifest",
        url: "https://github.com/actions/publish-action/blob/v0.1.0/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-action v0.2.0 action manifest",
        url: "https://github.com/actions/publish-action/blob/v0.2.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
  },
  {
    id: "github-actions.publish-action.node16",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/publish-action",
    vers: "vers:semver/>=0.2.0|<0.3.0",
    event: "end-of-support",
    title: "Unsupported actions/publish-action Node.js 16 runtime",
    summary:
      "Versions 0.2.0 through 0.2.2 declare Node.js 16. GitHub removed that runtime from Actions runners on 2024-11-12.",
    severity: "high",
    deadline: "2024-11-12",
    sources: [
      {
        title: "End of life for Actions Node16",
        url: "https://github.blog/changelog/2024-09-25-end-of-life-for-actions-node16/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-action v0.2.0 action manifest",
        url: "https://github.com/actions/publish-action/blob/v0.2.0/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-action v0.2.2 action manifest",
        url: "https://github.com/actions/publish-action/blob/v0.2.2/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-action v0.3.0 action manifest",
        url: "https://github.com/actions/publish-action/blob/v0.3.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
  },
  {
    id: "github-actions.publish-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/publish-action",
    vers: "vers:semver/0.3.0",
    event: "end-of-support",
    title: "Unsupported actions/publish-action Node.js 20 runtime",
    summary: "Version 0.3.0 declare Node.js 20. GitHub removed that runtime from Actions runners on 2026-09-23.",
    severity: "high",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-action v0.3.0 action manifest",
        url: "https://github.com/actions/publish-action/blob/v0.3.0/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-action v0.4.0 action manifest",
        url: "https://github.com/actions/publish-action/blob/v0.4.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
  },
  {
    id: "github-actions.publish-immutable-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/publish-immutable-action",
    vers: "vers:semver/<=0.0.4",
    event: "end-of-support",
    title: "Unsupported actions/publish-immutable-action Node.js 20 runtime",
    summary:
      "The v0 tag and its published releases through 0.0.4 declare Node.js 20. GitHub removed that runtime from Actions runners on 2026-09-23.",
    severity: "high",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-immutable-action v0 action manifest",
        url: "https://github.com/actions/publish-immutable-action/blob/v0/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-immutable-action v0.0.1 action manifest",
        url: "https://github.com/actions/publish-immutable-action/blob/v0.0.1/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/publish-immutable-action v0.0.4 action manifest",
        url: "https://github.com/actions/publish-immutable-action/blob/v0.0.4/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
  },
  {
    id: "github-actions.checkout.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/checkout",
    vers: "vers:semver/<5.0.0",
    event: "end-of-support",
    title: "Unsupported actions/checkout runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/checkout@v5 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/checkout runtime guidance",
        url: "https://github.com/actions/checkout#checkout-v5",
        accessedAt: "2026-10-16",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://github.com/actions/checkout#checkout-v5",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-10-14",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve checkout depth, credentials, submodule, and sparse-checkout behavior configured through action inputs.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade the checkout action",
          instructions: "Change the uses reference to actions/checkout@v5 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review checkout inputs",
          instructions: "Compare configured inputs with the target release and update renamed or changed options.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/checkout", supportedFromMajor: 5 },
  },
  {
    id: "github-actions.setup-node.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/setup-node",
    vers: "vers:semver/<5.0.0",
    event: "end-of-support",
    title: "Unsupported actions/setup-node runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/setup-node@v5 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/setup-node v5 runtime guidance",
        url: "https://github.com/actions/setup-node#breaking-changes-in-v5",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/actions/setup-node#breaking-changes-in-v5",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-10-14",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve the selected Node.js version, registry authentication, and dependency-cache behavior."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade setup-node",
          instructions: "Change the uses reference to actions/setup-node@v5 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review runtime and cache inputs",
          instructions:
            "Confirm node-version, registry-url, cache, and cache-dependency-path remain valid for the target release.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/setup-node", supportedFromMajor: 5 },
  },
  {
    id: "github-actions.cache.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/cache",
    vers: "vers:semver/>=3.0.0|<5.0.0",
    event: "end-of-support",
    title: "Unsupported actions/cache runtime",
    summary:
      "v3 sets runs.using to node16 and v4 sets it to node20. GitHub removed Node.js 20 from Actions runners on 2026-09-23. v5 sets runs.using to node24.",
    severity: "high",
    replacement: "actions/cache@v5 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/cache v3 action.yml",
        url: "https://github.com/actions/cache/blob/v3/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/cache v4 action.yml",
        url: "https://github.com/actions/cache/blob/v4/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/cache v5 action.yml",
        url: "https://github.com/actions/cache/blob/v5/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve cache keys, restore-key ordering, paths, and cache-hit dependent control flow."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade the cache action",
          instructions: "Change the uses reference to actions/cache@v5 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-cache-contract",
          title: "Review cache behavior",
          instructions:
            "Verify cache paths, keys, restore keys, and cache-hit output consumers against the target release.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/cache", supportedFromMajor: 5 },
  },
  {
    id: "github-actions.cache.service-v1-v2",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/cache",
    vers: "vers:semver/<3.0.0",
    event: "removed",
    title: "Retired actions/cache service",
    summary:
      "v1 and v2 of the actions/cache service were retired on 2025-03-01. Brownouts ran on 2025-02-04, 2025-02-11, and 2025-02-18. This retirement does not affect GitHub Enterprise Server.",
    severity: "critical",
    replacement: "actions/cache@v5 or later",
    deadline: "2025-03-01",
    sources: [
      {
        title: "Notice of upcoming deprecations and changes in GitHub Actions services",
        url: "https://github.blog/changelog/2024-09-16-notice-of-upcoming-deprecations-and-changes-in-github-actions-services/",
        accessedAt: "2026-11-15",
      },
      {
        title: "Notice of upcoming releases and breaking changes for GitHub Actions",
        url: "https://github.blog/changelog/2024-12-05-notice-of-upcoming-releases-and-breaking-changes-for-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/cache v5.0.0 Node.js 24 action manifest",
        url: "https://github.com/actions/cache/blob/v5.0.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: ["Preserve cache keys, restore-key ordering, paths, and cache-hit dependent control flow."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Move off the retired cache service",
          instructions: "On GitHub.com, change the uses reference to actions/cache@v5 or a later supported release.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/cache", supportedFromMajor: 3 },
  },
  {
    id: "github-actions.upload-artifact.v1-v2",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/upload-artifact",
    vers: "vers:semver/<3.0.0",
    event: "removed",
    title: "Removed actions/upload-artifact v1 and v2",
    summary:
      "v1 and v2 of actions/upload-artifact were removed on 2024-06-30. This removal does not affect GitHub Enterprise Server. v3 was removed later, on 2025-01-30.",
    severity: "critical",
    replacement: "actions/upload-artifact@v6 or later",
    deadline: "2024-06-30",
    sources: [
      {
        title: "Deprecation notice: v1 and v2 of the artifact actions",
        url: "https://github.blog/changelog/2024-02-13-deprecation-notice-v1-and-v2-of-the-artifact-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/upload-artifact v6.0.0 Node.js 24 action manifest",
        url: "https://github.com/actions/upload-artifact/blob/v6.0.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-11-15",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve artifact names, selected paths, retention settings, and overwrite behavior."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade upload-artifact",
          instructions:
            "On GitHub.com, change the uses reference to actions/upload-artifact@v6 or a later supported release.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/upload-artifact", supportedFromMajor: 3 },
  },
  {
    id: "github-actions.upload-artifact.retired",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/upload-artifact",
    vers: "vers:semver/>=3.0.0|<4.0.0",
    event: "removed",
    title: "Retired actions/upload-artifact release",
    summary:
      "v3 of actions/upload-artifact was removed on 2025-01-30. Brownouts ran on 2025-01-09, 2025-01-16, and 2025-01-23. This removal does not affect GitHub Enterprise Server. v1 and v2 were removed earlier, on 2024-06-30. v4 restores the artifact service and runs on Node.js 20.",
    severity: "critical",
    replacement: "actions/upload-artifact@v6 or later",
    deadline: "2025-01-30",
    sources: [
      {
        title: "Deprecation notice: v3 of the artifact actions",
        url: "https://github.blog/changelog/2024-04-16-deprecation-notice-v3-of-the-artifact-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "Notice of upcoming releases and breaking changes for GitHub Actions",
        url: "https://github.blog/changelog/2024-12-05-notice-of-upcoming-releases-and-breaking-changes-for-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/upload-artifact v6.0.0 Node.js 24 action manifest",
        url: "https://github.com/actions/upload-artifact/blob/v6.0.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve artifact names, selected paths, retention settings, and overwrite behavior."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade upload-artifact",
          instructions:
            "On GitHub.com, change the uses reference to actions/upload-artifact@v6 or a later supported release.",
          targets: "declaration",
        },
        {
          id: "review-artifact-inputs",
          title: "Review upload inputs",
          instructions:
            "Confirm artifact paths, names, retention-days, compression, and overwrite settings against the target release.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/upload-artifact", supportedFromMajor: 4 },
  },
  {
    id: "github-actions.upload-artifact.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/upload-artifact",
    vers: "vers:semver/>=4.0.0|<6.0.0",
    event: "end-of-support",
    title: "Unsupported actions/upload-artifact runtime",
    summary:
      "v4 and v5 set runs.using to node20. GitHub removed Node.js 20 from Actions runners on 2026-09-23. v6 sets runs.using to node24.",
    severity: "high",
    replacement: "actions/upload-artifact@v6 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/upload-artifact v5 action.yml",
        url: "https://github.com/actions/upload-artifact/blob/v5/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/upload-artifact v6 action.yml",
        url: "https://github.com/actions/upload-artifact/blob/v6/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: ["Preserve artifact names, selected paths, retention settings, and overwrite behavior."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade upload-artifact",
          instructions:
            "Change the uses reference to actions/upload-artifact@v6 or a later release. v4 and v5 still run on Node.js 20.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/upload-artifact", supportedFromMajor: 6 },
  },
  {
    id: "github-actions.download-artifact.v1-v2",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/download-artifact",
    vers: "vers:semver/<3.0.0",
    event: "removed",
    title: "Removed actions/download-artifact v1 and v2",
    summary:
      "v1 and v2 of actions/download-artifact were removed on 2024-06-30. This removal does not affect GitHub Enterprise Server. v3 was removed later, on 2025-01-30.",
    severity: "critical",
    replacement: "actions/download-artifact@v7 or later",
    deadline: "2024-06-30",
    sources: [
      {
        title: "Deprecation notice: v1 and v2 of the artifact actions",
        url: "https://github.blog/changelog/2024-02-13-deprecation-notice-v1-and-v2-of-the-artifact-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/download-artifact v7.0.0 Node.js 24 action manifest",
        url: "https://github.com/actions/download-artifact/blob/v7.0.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-11-15",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve artifact selection, download paths, merge behavior, and downstream file locations."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade download-artifact",
          instructions:
            "On GitHub.com, change the uses reference to actions/download-artifact@v7 or a later supported release.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/download-artifact", supportedFromMajor: 3 },
  },
  {
    id: "github-actions.download-artifact.retired",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/download-artifact",
    vers: "vers:semver/>=3.0.0|<4.0.0",
    event: "removed",
    title: "Retired actions/download-artifact release",
    summary:
      "v3 of actions/download-artifact was removed on 2025-01-30. Brownouts ran on 2025-01-09, 2025-01-16, and 2025-01-23. This removal does not affect GitHub Enterprise Server. v1 and v2 were removed earlier, on 2024-06-30. v4 restores the artifact service and runs on Node.js 20.",
    severity: "critical",
    replacement: "actions/download-artifact@v7 or later",
    deadline: "2025-01-30",
    sources: [
      {
        title: "Deprecation notice: v3 of the artifact actions",
        url: "https://github.blog/changelog/2024-04-16-deprecation-notice-v3-of-the-artifact-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "Notice of upcoming releases and breaking changes for GitHub Actions",
        url: "https://github.blog/changelog/2024-12-05-notice-of-upcoming-releases-and-breaking-changes-for-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/download-artifact v7.0.0 Node.js 24 action manifest",
        url: "https://github.com/actions/download-artifact/blob/v7.0.0/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve artifact selection, download paths, merge behavior, and downstream file locations."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade download-artifact",
          instructions:
            "On GitHub.com, change the uses reference to actions/download-artifact@v7 or a later supported release.",
          targets: "declaration",
        },
        {
          id: "review-artifact-layout",
          title: "Review downloaded layout",
          instructions:
            "Confirm artifact filters, paths, merge-multiple behavior, and downstream consumers against the target release.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/download-artifact", supportedFromMajor: 4 },
  },
  {
    id: "github-actions.download-artifact.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/download-artifact",
    vers: "vers:semver/>=4.0.0|<7.0.0",
    event: "end-of-support",
    title: "Unsupported actions/download-artifact runtime",
    summary:
      "v4, v5, and v6 set runs.using to node20. GitHub removed Node.js 20 from Actions runners on 2026-09-23. v7 sets runs.using to node24.",
    severity: "high",
    replacement: "actions/download-artifact@v7 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/download-artifact v6 action.yml",
        url: "https://github.com/actions/download-artifact/blob/v6/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/download-artifact v7 action.yml",
        url: "https://github.com/actions/download-artifact/blob/v7/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: ["Preserve artifact selection, download paths, merge behavior, and downstream file locations."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade download-artifact",
          instructions:
            "Change the uses reference to actions/download-artifact@v7 or a later release. v4, v5, and v6 still run on Node.js 20.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/download-artifact", supportedFromMajor: 7 },
  },
  {
    id: "github-actions.setup-python.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/setup-python",
    vers: "vers:semver/<6.0.0",
    event: "end-of-support",
    title: "Unsupported actions/setup-python runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/setup-python@v6 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/setup-python v6.0.0 release notes",
        url: "https://github.com/actions/setup-python/releases/tag/v6.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/actions/setup-python/releases/tag/v6.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve the requested Python version, caching, and architecture inputs when upgrading."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade setup-python",
          instructions: "Change the uses reference to actions/setup-python@v6 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review setup-python inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/setup-python", supportedFromMajor: 6 },
  },
  {
    id: "github-actions.setup-go.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/setup-go",
    vers: "vers:semver/<6.2.0",
    event: "end-of-support",
    title: "Unsupported actions/setup-go runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners. Version 6.0.0 and 6.1.0 still declare node20; version 6.2.0 and later declare node24.",
    severity: "high",
    replacement: "actions/setup-go@v6.2.0 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/setup-go v6.2.0 release notes (action.yml moves to node24)",
        url: "https://github.com/actions/setup-go/releases/tag/v6.2.0",
        accessedAt: "2026-11-15",
        archiveUrl:
          "https://web.archive.org/web/20261115000000/https://github.com/actions/setup-go/releases/tag/v6.2.0",
        archivedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-11-15",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve the requested Go version, module cache, and architecture inputs when upgrading."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade setup-go",
          instructions:
            "Change the uses reference to actions/setup-go@v6.2.0 or a later supported release. Versions 6.0.0 and 6.1.0 still run on node20.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review setup-go inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/setup-go", supportedFromMajor: 6 },
  },
  {
    id: "github-actions.setup-java.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/setup-java",
    vers: "vers:semver/<5.0.0",
    event: "end-of-support",
    title: "Unsupported actions/setup-java runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/setup-java@v5 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/setup-java v5.0.0 release notes",
        url: "https://github.com/actions/setup-java/releases/tag/v5.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/actions/setup-java/releases/tag/v5.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve the JDK distribution, version, build-tool cache, and publishing inputs when upgrading."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade setup-java",
          instructions: "Change the uses reference to actions/setup-java@v5 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review setup-java inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/setup-java", supportedFromMajor: 5 },
  },
  {
    id: "github-actions.setup-dotnet.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/setup-dotnet",
    vers: "vers:semver/<5.0.0",
    event: "end-of-support",
    title: "Unsupported actions/setup-dotnet runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/setup-dotnet@v5 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/setup-dotnet v5.0.0 release notes",
        url: "https://github.com/actions/setup-dotnet/releases/tag/v5.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/actions/setup-dotnet/releases/tag/v5.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the SDK version, global.json handling, and package-source authentication inputs when upgrading.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade setup-dotnet",
          instructions: "Change the uses reference to actions/setup-dotnet@v5 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review setup-dotnet inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/setup-dotnet", supportedFromMajor: 5 },
  },
  {
    id: "github-actions.github-script.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/github-script",
    vers: "vers:semver/<8.0.0",
    event: "end-of-support",
    title: "Unsupported actions/github-script runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/github-script@v8 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/github-script v8 release notes",
        url: "https://github.com/actions/github-script/releases/tag/v8",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/actions/github-script/releases/tag/v8",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the script, github-token, and result-encoding behavior; check the script against the target release's bundled Octokit.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade github-script",
          instructions: "Change the uses reference to actions/github-script@v8 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review github-script inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/github-script", supportedFromMajor: 8 },
  },
  {
    id: "github-actions.labeler.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/labeler",
    vers: "vers:semver/<6.0.0",
    event: "end-of-support",
    title: "Unsupported actions/labeler runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/labeler@v6 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/labeler v6.0.0 release notes",
        url: "https://github.com/actions/labeler/releases/tag/v6.0.0",
        accessedAt: "2026-10-16",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://github.com/actions/labeler/releases/tag/v6.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the labeler configuration file location, sync-labels behavior, and token permissions when upgrading.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade labeler",
          instructions: "Change the uses reference to actions/labeler@v6 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review labeler inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/labeler", supportedFromMajor: 6 },
  },
  {
    id: "github-actions.stale.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/stale",
    vers: "vers:semver/<10.0.0",
    event: "end-of-support",
    title: "Unsupported actions/stale runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/stale@v10 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/stale v10.0.0 release notes",
        url: "https://github.com/actions/stale/releases/tag/v10.0.0",
        accessedAt: "2026-10-16",
        archiveUrl: "https://web.archive.org/web/20261016000000/https://github.com/actions/stale/releases/tag/v10.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the stale and close timing, exempt labels, and operations-per-run limits when upgrading.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade stale",
          instructions: "Change the uses reference to actions/stale@v10 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review stale inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/stale", supportedFromMajor: 10 },
  },
  {
    id: "github-actions.configure-pages.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/configure-pages",
    vers: "vers:semver/<6.0.0",
    event: "end-of-support",
    title: "Unsupported actions/configure-pages runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners. On GitHub.com, custom Pages workflows must use actions/upload-pages-artifact@v3 and actions/deploy-pages@v4 from 2025-01-30. That requirement does not affect GitHub Enterprise Server.",
    severity: "high",
    replacement: "actions/configure-pages@v6 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/configure-pages v6.0.0 release notes",
        url: "https://github.com/actions/configure-pages/releases/tag/v6.0.0",
        accessedAt: "2026-11-15",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/actions/configure-pages/releases/tag/v6.0.0",
        archivedAt: "2026-10-16",
      },
      {
        title: "Deprecation notice: GitHub Pages actions to require artifacts actions v4 on GitHub.com",
        url: "https://github.blog/changelog/2024-12-05-deprecation-notice-github-pages-actions-to-require-artifacts-actions-v4-on-github-com/",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: ["Preserve the Pages site configuration and static-site generator inputs when upgrading."],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade configure-pages",
          instructions: "Change the uses reference to actions/configure-pages@v6 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review configure-pages inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/configure-pages", supportedFromMajor: 6 },
  },
  {
    id: "github-actions.deploy-pages.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/deploy-pages",
    vers: "vers:semver/<5.0.0",
    event: "end-of-support",
    title: "Unsupported actions/deploy-pages runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners. On GitHub.com, custom Pages workflows must use actions/upload-pages-artifact@v3 and actions/deploy-pages@v4 from 2025-01-30. That requirement does not affect GitHub Enterprise Server.",
    severity: "high",
    replacement: "actions/deploy-pages@v5 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/deploy-pages v5.0.0 release notes",
        url: "https://github.com/actions/deploy-pages/releases/tag/v5.0.0",
        accessedAt: "2026-11-15",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/actions/deploy-pages/releases/tag/v5.0.0",
        archivedAt: "2026-10-16",
      },
      {
        title: "Deprecation notice: GitHub Pages actions to require artifacts actions v4 on GitHub.com",
        url: "https://github.blog/changelog/2024-12-05-deprecation-notice-github-pages-actions-to-require-artifacts-actions-v4-on-github-com/",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the artifact name, environment, and the pages and id-token permissions the deployment job needs.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade deploy-pages",
          instructions: "Change the uses reference to actions/deploy-pages@v5 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review deploy-pages inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/deploy-pages", supportedFromMajor: 5 },
  },
  {
    id: "github-actions.create-github-app-token.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/create-github-app-token",
    vers: "vers:semver/<3.0.0",
    event: "end-of-support",
    title: "Unsupported actions/create-github-app-token runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/create-github-app-token@v3 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/create-github-app-token v3.0.0 release notes",
        url: "https://github.com/actions/create-github-app-token/releases/tag/v3.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/actions/create-github-app-token/releases/tag/v3.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the app identifier, private key input, owner and repository scoping, and requested permissions when upgrading.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade create-github-app-token",
          instructions: "Change the uses reference to actions/create-github-app-token@v3 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review create-github-app-token inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/create-github-app-token", supportedFromMajor: 3 },
  },
  {
    id: "github-actions.first-interaction.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/first-interaction",
    vers: "vers:semver/<3.0.0",
    event: "end-of-support",
    title: "Unsupported actions/first-interaction runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "actions/first-interaction@v3 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "actions/first-interaction v3.0.0 release notes",
        url: "https://github.com/actions/first-interaction/releases/tag/v3.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/actions/first-interaction/releases/tag/v3.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the welcome messages and the token inputs when upgrading; v3 renamed some inputs, so compare them with the release notes.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade first-interaction",
          instructions: "Change the uses reference to actions/first-interaction@v3 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review first-interaction inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/first-interaction", supportedFromMajor: 3 },
  },
  {
    id: "github-actions.ai-inference.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/ai-inference",
    vers: "vers:semver/<2.0.0",
    event: "end-of-support",
    title: "Unsupported actions/ai-inference runtime",
    summary:
      "v1, and the 0.x tags, set runs.using to node20. GitHub removed Node.js 20 from Actions runners on 2026-09-23. v2 sets runs.using to node24.",
    severity: "high",
    replacement: "actions/ai-inference@v2 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/ai-inference v1 action.yml",
        url: "https://github.com/actions/ai-inference/blob/v1/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/ai-inference v2 action.yml",
        url: "https://github.com/actions/ai-inference/blob/v2/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: [
        "Keep prompt, model, and token. v2's action.yml adds temperature, top-p, and max-completion-tokens, which v1 does not declare. v3's action.yml drops endpoint, max-tokens, temperature, and top-p.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade ai-inference",
          instructions:
            "Change the uses reference to actions/ai-inference@v2 or a later major whose action.yml sets runs.using to node24.",
          targets: "declaration",
        },
        {
          id: "review-inference-inputs",
          title: "Review inference inputs",
          instructions:
            "Compare prompt, model, token, and sampling inputs with the target major's action.yml before moving past v2.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/ai-inference", supportedFromMajor: 2 },
  },
  {
    id: "github-actions.attest.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/attest",
    vers: "vers:semver/<3.0.0",
    event: "end-of-support",
    title: "Unsupported actions/attest runtime",
    summary:
      "v1 and v2 set runs.using to node20, as do the v0.1 tags. GitHub removed Node.js 20 from Actions runners on 2026-09-23. v3 sets runs.using to node24.",
    severity: "high",
    replacement: "actions/attest@v3 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/attest v2 action.yml",
        url: "https://github.com/actions/attest/blob/v2/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/attest v3 action.yml",
        url: "https://github.com/actions/attest/blob/v3/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: [
        "Keep subject-path or subject-digest, predicate-type, and predicate. v2's action.yml adds subject-checksums, attestation-id, and attestation-url. v3 keeps those inputs and sets runs.using to node24.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade attest",
          instructions: "Change the uses reference to actions/attest@v3 or a later major.",
          targets: "declaration",
        },
        {
          id: "review-attestation-inputs",
          title: "Review attestation inputs",
          instructions:
            "Confirm subject, predicate, and bundle outputs against the v3 action.yml. v1 does not declare subject-checksums, attestation-id, or attestation-url.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/attest", supportedFromMajor: 3 },
  },
  {
    id: "github-actions.delete-package-versions.node12",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/delete-package-versions",
    vers: "vers:semver/<3.0.0",
    event: "end-of-support",
    title: "Unsupported actions/delete-package-versions runtime",
    summary: "v1 and v2 set runs.using to node12. GitHub removed Node.js 12 from Actions runners on 2023-08-14.",
    severity: "high",
    replacement: "No supported major of actions/delete-package-versions is published",
    deadline: "2023-08-14",
    sources: [
      {
        title: "Removal of Node12 from the Actions runner",
        url: "https://github.blog/changelog/2023-07-16-github-actions-removal-of-node12-from-the-actions-runner/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/delete-package-versions v2 action.yml",
        url: "https://github.com/actions/delete-package-versions/blob/v2/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: ["No published major sets runs.using to node24. v5 and the default branch both set it to node20."],
      steps: [
        {
          id: "stop-using-retired-majors",
          title: "Stop pinning a retired major",
          instructions:
            "Do not move to v5. Keep package-name, package-type, token, and the version-selection inputs until a release sets runs.using to node24.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/delete-package-versions" },
  },
  {
    id: "github-actions.delete-package-versions.node16",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/delete-package-versions",
    vers: "vers:semver/>=3.0.0|<5.0.0",
    event: "end-of-support",
    title: "Unsupported actions/delete-package-versions runtime",
    summary: "v3 and v4 set runs.using to node16. GitHub removed Node.js 16 from Actions runners on 2024-11-12.",
    severity: "high",
    replacement: "No supported major of actions/delete-package-versions is published",
    deadline: "2024-11-12",
    sources: [
      {
        title: "End of life for Actions Node16",
        url: "https://github.blog/changelog/2024-09-25-end-of-life-for-actions-node16/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/delete-package-versions v4 action.yml",
        url: "https://github.com/actions/delete-package-versions/blob/v4/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: ["No published major sets runs.using to node24. v5 and the default branch both set it to node20."],
      steps: [
        {
          id: "stop-using-retired-majors",
          title: "Stop pinning a retired major",
          instructions:
            "Do not move to v5. Keep package-name, package-type, token, and the version-selection inputs until a release sets runs.using to node24.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/delete-package-versions" },
  },
  {
    id: "github-actions.delete-package-versions.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/delete-package-versions",
    vers: "vers:semver/>=5.0.0|<6.0.0",
    event: "end-of-support",
    title: "Unsupported actions/delete-package-versions runtime",
    summary:
      "v5 sets runs.using to node20, and the default branch still does. GitHub removed Node.js 20 from Actions runners on 2026-09-23. No later major is published.",
    severity: "high",
    replacement: "No supported major of actions/delete-package-versions is published",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/delete-package-versions v5 action.yml",
        url: "https://github.com/actions/delete-package-versions/blob/v5/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/delete-package-versions main action.yml",
        url: "https://github.com/actions/delete-package-versions/blob/main/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: ["No published major sets runs.using to node24. v5 and the default branch both set it to node20."],
      steps: [
        {
          id: "stop-using-retired-majors",
          title: "Stop pinning a retired major",
          instructions:
            "Do not move to v5. Keep package-name, package-type, token, and the version-selection inputs until a release sets runs.using to node24.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/delete-package-versions" },
  },
  {
    id: "github-actions.dependency-review-action.node16",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/dependency-review-action",
    vers: "vers:semver/<4.0.0",
    event: "end-of-support",
    title: "Unsupported actions/dependency-review-action runtime",
    summary:
      "v1, v2, and v3 set runs.using to node16. GitHub removed Node.js 16 from Actions runners on 2024-11-12. v5 sets runs.using to node24.",
    severity: "high",
    replacement: "actions/dependency-review-action@v5 or later",
    deadline: "2024-11-12",
    sources: [
      {
        title: "End of life for Actions Node16",
        url: "https://github.blog/changelog/2024-09-25-end-of-life-for-actions-node16/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/dependency-review-action v3 action.yml",
        url: "https://github.com/actions/dependency-review-action/blob/v3/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/dependency-review-action v5 action.yml",
        url: "https://github.com/actions/dependency-review-action/blob/v5/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: [
        "Keep fail-on-severity, the license and package lists, and repo-token. The v4 and v5 action.yml files declare the same input names; v5 sets runs.using to node24.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade dependency-review-action",
          instructions:
            "Change the uses reference to actions/dependency-review-action@v5 or a later major. v4 still sets runs.using to node20.",
          targets: "declaration",
        },
        {
          id: "review-dependency-policy",
          title: "Review dependency policy inputs",
          instructions:
            "Keep fail-on-severity, license allow and deny lists, and deny-packages aligned with the v5 action.yml.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/dependency-review-action", supportedFromMajor: 5 },
  },
  {
    id: "github-actions.dependency-review-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/dependency-review-action",
    vers: "vers:semver/>=4.0.0|<5.0.0",
    event: "end-of-support",
    title: "Unsupported actions/dependency-review-action runtime",
    summary:
      "v4 sets runs.using to node20. GitHub removed Node.js 20 from Actions runners on 2026-09-23. v5 sets runs.using to node24.",
    severity: "high",
    replacement: "actions/dependency-review-action@v5 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/dependency-review-action v4 action.yml",
        url: "https://github.com/actions/dependency-review-action/blob/v4/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/dependency-review-action v5 action.yml",
        url: "https://github.com/actions/dependency-review-action/blob/v5/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: [
        "Keep fail-on-severity, the license and package lists, and repo-token. The v4 and v5 action.yml files declare the same input names; v5 sets runs.using to node24.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade dependency-review-action",
          instructions:
            "Change the uses reference to actions/dependency-review-action@v5 or a later major. v4 still sets runs.using to node20.",
          targets: "declaration",
        },
        {
          id: "review-dependency-policy",
          title: "Review dependency policy inputs",
          instructions:
            "Keep fail-on-severity, license allow and deny lists, and deny-packages aligned with the v5 action.yml.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/dependency-review-action", supportedFromMajor: 5 },
  },
  {
    id: "github-actions.go-dependency-submission.node16",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/go-dependency-submission",
    vers: "vers:semver/<2.0.0",
    event: "end-of-support",
    title: "Unsupported actions/go-dependency-submission runtime",
    summary: "v1 sets runs.using to node16. GitHub removed Node.js 16 from Actions runners on 2024-11-12.",
    severity: "high",
    replacement: "A published actions/go-dependency-submission release whose action.yml sets runs.using to node24",
    deadline: "2024-11-12",
    sources: [
      {
        title: "End of life for Actions Node16",
        url: "https://github.blog/changelog/2024-09-25-end-of-life-for-actions-node16/",
        accessedAt: "2026-11-26",
      },
      {
        title: "actions/go-dependency-submission v1 action.yml",
        url: "https://raw.githubusercontent.com/actions/go-dependency-submission/v1/action.yml",
        accessedAt: "2026-11-26",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-26", reviewer: "arminazimi", method: "manual" },
    migration: {
      constraints: [
        "v1 sets runs.using to node16 and v2 sets it to node20. The default branch sets runs.using to node24 and adds snapshot-sha, snapshot-ref, detector-name, detector-version, and detector-url. That branch is not tagged as a major.",
      ],
      steps: [
        {
          id: "wait-for-node24-release",
          title: "Move to a Node.js 24 release",
          instructions:
            "Do not stay on v2. Keep token, go-mod-path, and go-build-target, and review the snapshot and detector inputs on the default branch when a major that sets runs.using to node24 is published.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/go-dependency-submission" },
  },
  {
    id: "github-actions.go-dependency-submission.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/go-dependency-submission",
    vers: "vers:semver/>=2.0.0|<3.0.0",
    event: "end-of-support",
    title: "Unsupported actions/go-dependency-submission runtime",
    summary:
      "v2 sets runs.using to node20. GitHub removed Node.js 20 from Actions runners on 2026-09-23. The default branch sets runs.using to node24 and is not tagged as a major.",
    severity: "high",
    replacement: "A published actions/go-dependency-submission release whose action.yml sets runs.using to node24",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/go-dependency-submission v2 action.yml",
        url: "https://github.com/actions/go-dependency-submission/blob/v2/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/go-dependency-submission main action.yml",
        url: "https://github.com/actions/go-dependency-submission/blob/main/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: [
        "v1 sets runs.using to node16 and v2 sets it to node20. The default branch sets runs.using to node24 and adds snapshot-sha, snapshot-ref, detector-name, detector-version, and detector-url. That branch is not tagged as a major.",
      ],
      steps: [
        {
          id: "wait-for-node24-release",
          title: "Move to a Node.js 24 release",
          instructions:
            "Do not stay on v2. Keep token, go-mod-path, and go-build-target, and review the snapshot and detector inputs on the default branch when a major that sets runs.using to node24 is published.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/go-dependency-submission" },
  },
  {
    id: "github-actions.codeql-action.node12",
    ecosystem: "github-actions",
    purl: "pkg:github/github/codeql-action",
    vers: "vers:semver/<2.0.0",
    event: "end-of-support",
    title: "Unsupported github/codeql-action runtime",
    summary:
      "v1 of github/codeql-action/init, autobuild, analyze, and upload-sarif sets runs.using to node12. GitHub removed Node.js 12 from Actions runners on 2023-08-14.",
    severity: "high",
    replacement: "github/codeql-action/{init,autobuild,analyze,upload-sarif}@v4 or later",
    deadline: "2023-08-14",
    sources: [
      {
        title: "Removal of Node12 from the Actions runner",
        url: "https://github.blog/changelog/2023-07-16-github-actions-removal-of-node12-from-the-actions-runner/",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v1 init/action.yml",
        url: "https://github.com/github/codeql-action/blob/v1/init/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v1 autobuild/action.yml",
        url: "https://github.com/github/codeql-action/blob/v1/autobuild/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v1 analyze/action.yml",
        url: "https://github.com/github/codeql-action/blob/v1/analyze/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v1 upload-sarif/action.yml",
        url: "https://github.com/github/codeql-action/blob/v1/upload-sarif/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: [
        "Keep the CodeQL language, queries, and SARIF upload inputs. init, autobuild, analyze, and upload-sarif move together.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade CodeQL actions",
          instructions:
            "Change each uses reference to github/codeql-action/init@v4, autobuild@v4, analyze@v4, or upload-sarif@v4, or a later major. v1 uses node12, v2 uses node16, and v3 uses node20.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "github/codeql-action", supportedFromMajor: 4 },
  },
  {
    id: "github-actions.codeql-action.node16",
    ecosystem: "github-actions",
    purl: "pkg:github/github/codeql-action",
    vers: "vers:semver/>=2.0.0|<3.0.0",
    event: "end-of-support",
    title: "Unsupported github/codeql-action runtime",
    summary:
      "v2 of github/codeql-action/init, autobuild, analyze, and upload-sarif sets runs.using to node16. GitHub removed Node.js 16 from Actions runners on 2024-11-12.",
    severity: "high",
    replacement: "github/codeql-action/{init,autobuild,analyze,upload-sarif}@v4 or later",
    deadline: "2024-11-12",
    sources: [
      {
        title: "End of life for Actions Node16",
        url: "https://github.blog/changelog/2024-09-25-end-of-life-for-actions-node16/",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v2 init/action.yml",
        url: "https://github.com/github/codeql-action/blob/v2/init/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v2 autobuild/action.yml",
        url: "https://github.com/github/codeql-action/blob/v2/autobuild/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v2 analyze/action.yml",
        url: "https://github.com/github/codeql-action/blob/v2/analyze/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v2 upload-sarif/action.yml",
        url: "https://github.com/github/codeql-action/blob/v2/upload-sarif/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: [
        "Keep the CodeQL language, queries, and SARIF upload inputs. init, autobuild, analyze, and upload-sarif move together.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade CodeQL actions",
          instructions:
            "Change each uses reference to github/codeql-action/init@v4, autobuild@v4, analyze@v4, or upload-sarif@v4, or a later major. v1 uses node12, v2 uses node16, and v3 uses node20.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "github/codeql-action", supportedFromMajor: 4 },
  },
  {
    id: "github-actions.codeql-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/github/codeql-action",
    vers: "vers:semver/>=3.0.0|<4.0.0",
    event: "end-of-support",
    title: "Unsupported github/codeql-action runtime",
    summary:
      "v3 of github/codeql-action/init, autobuild, analyze, and upload-sarif sets runs.using to node20. GitHub removed Node.js 20 from Actions runners on 2026-09-23. v4 sets runs.using to node24.",
    severity: "high",
    replacement: "github/codeql-action/{init,autobuild,analyze,upload-sarif}@v4 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v3 init/action.yml",
        url: "https://github.com/github/codeql-action/blob/v3/init/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v3 autobuild/action.yml",
        url: "https://github.com/github/codeql-action/blob/v3/autobuild/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v3 analyze/action.yml",
        url: "https://github.com/github/codeql-action/blob/v3/analyze/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v3 upload-sarif/action.yml",
        url: "https://github.com/github/codeql-action/blob/v3/upload-sarif/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v4 init/action.yml",
        url: "https://github.com/github/codeql-action/blob/v4/init/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v4 autobuild/action.yml",
        url: "https://github.com/github/codeql-action/blob/v4/autobuild/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v4 analyze/action.yml",
        url: "https://github.com/github/codeql-action/blob/v4/analyze/action.yml",
        accessedAt: "2026-11-15",
      },
      {
        title: "github/codeql-action v4 upload-sarif/action.yml",
        url: "https://github.com/github/codeql-action/blob/v4/upload-sarif/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: { observedAt: "2026-11-15", reviewedAt: "2026-11-15", reviewer: "unreviewed", method: "manual" },
    migration: {
      constraints: [
        "Keep the CodeQL language, queries, and SARIF upload inputs. init, autobuild, analyze, and upload-sarif move together.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade CodeQL actions",
          instructions:
            "Change each uses reference to github/codeql-action/init@v4, autobuild@v4, analyze@v4, or upload-sarif@v4, or a later major. v1 uses node12, v2 uses node16, and v3 uses node20.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "github/codeql-action", supportedFromMajor: 4 },
  },
  {
    id: "github-actions.setup-buildx-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/docker/setup-buildx-action",
    vers: "vers:semver/<4.0.0",
    event: "end-of-support",
    title: "Unsupported docker/setup-buildx-action runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "docker/setup-buildx-action@v4 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "docker/setup-buildx-action v4.0.0 release notes",
        url: "https://github.com/docker/setup-buildx-action/releases/tag/v4.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/docker/setup-buildx-action/releases/tag/v4.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the builder driver, version, and endpoint inputs; Node 24 needs Actions Runner v2.327.1 or later on self-hosted runners.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade setup-buildx-action",
          instructions: "Change the uses reference to docker/setup-buildx-action@v4 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review setup-buildx-action inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "docker/setup-buildx-action", supportedFromMajor: 4 },
  },
  {
    id: "github-actions.build-push-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/docker/build-push-action",
    vers: "vers:semver/<7.0.0",
    event: "end-of-support",
    title: "Unsupported docker/build-push-action runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "docker/build-push-action@v7 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "docker/build-push-action v7.0.0 release notes",
        url: "https://github.com/docker/build-push-action/releases/tag/v7.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/docker/build-push-action/releases/tag/v7.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the build context, tags, platforms, cache, and push settings; Node 24 needs Actions Runner v2.327.1 or later on self-hosted runners.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade build-push-action",
          instructions: "Change the uses reference to docker/build-push-action@v7 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review build-push-action inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "docker/build-push-action", supportedFromMajor: 7 },
  },
  {
    id: "github-actions.login-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/docker/login-action",
    vers: "vers:semver/<4.0.0",
    event: "end-of-support",
    title: "Unsupported docker/login-action runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "docker/login-action@v4 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "docker/login-action v4.0.0 release notes",
        url: "https://github.com/docker/login-action/releases/tag/v4.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/docker/login-action/releases/tag/v4.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the registry, username, and secret inputs; Node 24 needs Actions Runner v2.327.1 or later on self-hosted runners.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade login-action",
          instructions: "Change the uses reference to docker/login-action@v4 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review login-action inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "docker/login-action", supportedFromMajor: 4 },
  },
  {
    id: "github-actions.setup-qemu-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/docker/setup-qemu-action",
    vers: "vers:semver/<4.0.0",
    event: "end-of-support",
    title: "Unsupported docker/setup-qemu-action runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "docker/setup-qemu-action@v4 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "docker/setup-qemu-action v4.0.0 release notes",
        url: "https://github.com/docker/setup-qemu-action/releases/tag/v4.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/docker/setup-qemu-action/releases/tag/v4.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the emulated platforms and image inputs; Node 24 needs Actions Runner v2.327.1 or later on self-hosted runners.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade setup-qemu-action",
          instructions: "Change the uses reference to docker/setup-qemu-action@v4 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review setup-qemu-action inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "docker/setup-qemu-action", supportedFromMajor: 4 },
  },
  {
    id: "github-actions.metadata-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/docker/metadata-action",
    vers: "vers:semver/<6.0.0",
    event: "end-of-support",
    title: "Unsupported docker/metadata-action runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "docker/metadata-action@v6 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "docker/metadata-action v6.0.0 release notes",
        url: "https://github.com/docker/metadata-action/releases/tag/v6.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/docker/metadata-action/releases/tag/v6.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the images, tags, and labels configuration so published image names do not change; Node 24 needs Actions Runner v2.327.1 or later on self-hosted runners.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade metadata-action",
          instructions: "Change the uses reference to docker/metadata-action@v6 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review metadata-action inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "docker/metadata-action", supportedFromMajor: 6 },
  },
  {
    id: "github-actions.action-gh-release.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/softprops/action-gh-release",
    vers: "vers:semver/<3.0.0",
    event: "end-of-support",
    title: "Unsupported softprops/action-gh-release runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "softprops/action-gh-release@v3 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "softprops/action-gh-release v3.0.0 release notes",
        url: "https://github.com/softprops/action-gh-release/releases/tag/v3.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/softprops/action-gh-release/releases/tag/v3.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the release tag, name, notes, draft and prerelease flags, and the files to upload; the job still needs contents: write.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade action-gh-release",
          instructions: "Change the uses reference to softprops/action-gh-release@v3 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review action-gh-release inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "softprops/action-gh-release", supportedFromMajor: 3 },
  },
  {
    id: "github-actions.setup-terraform.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/hashicorp/setup-terraform",
    vers: "vers:semver/<4.0.0",
    event: "end-of-support",
    title: "Unsupported hashicorp/setup-terraform runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "hashicorp/setup-terraform@v4 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "hashicorp/setup-terraform v4.0.0 release notes",
        url: "https://github.com/hashicorp/setup-terraform/releases/tag/v4.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/hashicorp/setup-terraform/releases/tag/v4.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the Terraform version, CLI configuration credentials, and wrapper setting when upgrading.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade setup-terraform",
          instructions: "Change the uses reference to hashicorp/setup-terraform@v4 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review setup-terraform inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "hashicorp/setup-terraform", supportedFromMajor: 4 },
  },
  {
    id: "github-actions.setup-uv.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/astral-sh/setup-uv",
    vers: "vers:semver/<7.0.0",
    event: "end-of-support",
    title: "Unsupported astral-sh/setup-uv runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "astral-sh/setup-uv@v7 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "astral-sh/setup-uv v7.0.0 release notes",
        url: "https://github.com/astral-sh/setup-uv/releases/tag/v7.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/astral-sh/setup-uv/releases/tag/v7.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the uv version, Python version, and cache inputs; v7 is a breaking release, so read its notes before upgrading self-hosted runners.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade setup-uv",
          instructions: "Change the uses reference to astral-sh/setup-uv@v7 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review setup-uv inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "astral-sh/setup-uv", supportedFromMajor: 7 },
  },
  {
    id: "github-actions.bake-action.node20",
    ecosystem: "github-actions",
    purl: "pkg:github/docker/bake-action",
    vers: "vers:semver/<7.0.0",
    event: "end-of-support",
    title: "Unsupported docker/bake-action runtime",
    summary:
      "This release predates the action's Node.js 24 runtime. GitHub no longer provides Node.js 20 on Actions runners.",
    severity: "high",
    replacement: "docker/bake-action@v7 or later",
    deadline: "2026-09-23",
    sources: [
      {
        title: "Node 20 is no longer available in GitHub Actions",
        url: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
        archivedAt: "2026-10-16",
      },
      {
        title: "docker/bake-action v7.0.0 release notes",
        url: "https://github.com/docker/bake-action/releases/tag/v7.0.0",
        accessedAt: "2026-10-16",
        archiveUrl:
          "https://web.archive.org/web/20261016000000/https://github.com/docker/bake-action/releases/tag/v7.0.0",
        archivedAt: "2026-10-16",
      },
    ],
    provenance: {
      observedAt: "2026-10-16",
      reviewedAt: "2026-10-16",
      reviewer: "claude-agent",
      reviewers: ["claude-agent"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Preserve the bake targets, files, and push settings; Node 24 needs Actions Runner v2.327.1 or later on self-hosted runners.",
      ],
      steps: [
        {
          id: "upgrade-action-ref",
          title: "Upgrade bake-action",
          instructions: "Change the uses reference to docker/bake-action@v7 or a later supported major.",
          targets: "declaration",
        },
        {
          id: "review-action-inputs",
          title: "Review bake-action inputs",
          instructions:
            "Compare configured inputs with the target release and update renamed or changed options; confirm the runner meets the release's minimum version.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "docker/bake-action", supportedFromMajor: 7 },
  },
  {
    id: "github-actions.workflow-command.set-output",
    ecosystem: "github-actions",
    purl: "pkg:generic/github-actions/set-output",
    vers: "vers:semver/*",
    event: "deprecated",
    title: "Deprecated GitHub Actions ::set-output command",
    summary:
      "GitHub deprecated the ::set-output workflow command. Append to the GITHUB_OUTPUT environment file instead.",
    severity: "medium",
    replacement: "$GITHUB_OUTPUT",
    sources: [
      {
        title: "GitHub Actions: Deprecating save-state and set-output commands",
        url: "https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/",
        accessedAt: "2026-11-05",
        archiveUrl:
          "https://web.archive.org/web/20261105000000/https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/",
        archivedAt: "2026-11-05",
      },
    ],
    provenance: {
      observedAt: "2026-11-05",
      reviewedAt: "2026-11-05",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Use environment files with a runner version supporting them. Multiline values require delimiter syntax.",
        "Preserve the effective shell and quote expansion; never copy encoded command values directly.",
      ],
      steps: [
        {
          id: "use-environment-file",
          title: "Append to GITHUB_OUTPUT",
          instructions:
            'Replace literal single-line echo commands with the corresponding environment-file append to "$GITHUB_OUTPUT". Migrate complex values manually.',
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Review the workflow patch before running it." }],
    },
  },
  {
    id: "github-actions.workflow-command.save-state",
    ecosystem: "github-actions",
    purl: "pkg:generic/github-actions/save-state",
    vers: "vers:semver/*",
    event: "deprecated",
    title: "Deprecated GitHub Actions ::save-state command",
    summary:
      "GitHub deprecated the ::save-state workflow command. Append to the GITHUB_STATE environment file instead.",
    severity: "medium",
    replacement: "$GITHUB_STATE",
    sources: [
      {
        title: "GitHub Actions: Deprecating save-state and set-output commands",
        url: "https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/",
        accessedAt: "2026-11-05",
        archiveUrl:
          "https://web.archive.org/web/20261105000000/https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/",
        archivedAt: "2026-11-05",
      },
    ],
    provenance: {
      observedAt: "2026-11-05",
      reviewedAt: "2026-11-05",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Use environment files with a runner version supporting them. Multiline values require delimiter syntax.",
        "Preserve the effective shell and quote expansion; never copy encoded command values directly.",
      ],
      steps: [
        {
          id: "use-environment-file",
          title: "Append to GITHUB_STATE",
          instructions:
            'Replace literal single-line echo commands with the corresponding environment-file append to "$GITHUB_STATE". Migrate complex values manually.',
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Review the workflow patch before running it." }],
    },
  },
  {
    id: "github-actions.workflow-command.set-env",
    ecosystem: "github-actions",
    purl: "pkg:generic/github-actions/set-env",
    vers: "vers:semver/*",
    event: "removed",
    title: "Removed GitHub Actions ::set-env command",
    summary: "GitHub removed the ::set-env workflow command. Append to the GITHUB_ENV environment file instead.",
    severity: "high",
    replacement: "$GITHUB_ENV",
    sources: [
      {
        title: "GitHub Actions: Removing set-env and add-path commands on November 16",
        url: "https://github.blog/changelog/2020-11-09-github-actions-removing-set-env-and-add-path-commands-on-november-16/",
        accessedAt: "2026-11-05",
        archiveUrl:
          "https://web.archive.org/web/20261105000000/https://github.blog/changelog/2020-11-09-github-actions-removing-set-env-and-add-path-commands-on-november-16/",
        archivedAt: "2026-11-05",
      },
    ],
    provenance: {
      observedAt: "2026-11-05",
      reviewedAt: "2026-11-05",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Use environment files with a runner version supporting them. Multiline values require delimiter syntax.",
        "Preserve the effective shell and quote expansion; never copy encoded command values directly.",
      ],
      steps: [
        {
          id: "use-environment-file",
          title: "Append to GITHUB_ENV",
          instructions:
            'Replace literal single-line echo commands with the corresponding environment-file append to "$GITHUB_ENV". Migrate complex values manually.',
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Review the workflow patch before running it." }],
    },
    deadline: "2020-11-16",
  },
  {
    id: "github-actions.workflow-command.add-path",
    ecosystem: "github-actions",
    purl: "pkg:generic/github-actions/add-path",
    vers: "vers:semver/*",
    event: "removed",
    title: "Removed GitHub Actions ::add-path command",
    summary: "GitHub removed the ::add-path workflow command. Append to the GITHUB_PATH environment file instead.",
    severity: "high",
    replacement: "$GITHUB_PATH",
    sources: [
      {
        title: "GitHub Actions: Removing set-env and add-path commands on November 16",
        url: "https://github.blog/changelog/2020-11-09-github-actions-removing-set-env-and-add-path-commands-on-november-16/",
        accessedAt: "2026-11-05",
        archiveUrl:
          "https://web.archive.org/web/20261105000000/https://github.blog/changelog/2020-11-09-github-actions-removing-set-env-and-add-path-commands-on-november-16/",
        archivedAt: "2026-11-05",
      },
    ],
    provenance: {
      observedAt: "2026-11-05",
      reviewedAt: "2026-11-05",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
    migration: {
      constraints: [
        "Use environment files with a runner version supporting them. Multiline values require delimiter syntax.",
        "Preserve the effective shell and quote expansion; never copy encoded command values directly.",
      ],
      steps: [
        {
          id: "use-environment-file",
          title: "Append to GITHUB_PATH",
          instructions:
            'Replace literal single-line echo commands with the corresponding environment-file append to "$GITHUB_PATH". Migrate complex values manually.',
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Review the workflow patch before running it." }],
    },
    deadline: "2020-11-16",
  },
  {
    id: "github-actions.hello-world-javascript-action.node12",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/hello-world-javascript-action",
    vers: "vers:semver/<2.0.0",
    event: "end-of-support",
    title: "Unsupported actions/hello-world-javascript-action runtime",
    summary:
      "v1 sets runs.using to node12. GitHub removed Node.js 12 from Actions runners on 2023-08-14. No later major is published.",
    severity: "high",
    replacement: "No supported major of actions/hello-world-javascript-action is published",
    deadline: "2023-08-14",
    sources: [
      {
        title: "Removal of Node12 from the Actions runner",
        url: "https://github.blog/changelog/2023-07-16-github-actions-removal-of-node12-from-the-actions-runner/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/hello-world-javascript-action v1 action.yml",
        url: "https://github.com/actions/hello-world-javascript-action/blob/v1/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-11-15",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: [
        "This repository is a starter template. v1 is the only published major and it sets runs.using to node12.",
      ],
      steps: [
        {
          id: "stop-using-retired-major",
          title: "Stop pinning v1",
          instructions:
            "Do not pin actions/hello-world-javascript-action@v1. Copy the template and set runs.using to node24 before publishing a workflow that uses it.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/hello-world-javascript-action" },
  },
  {
    id: "github-actions.javascript-action.node12",
    ecosystem: "github-actions",
    purl: "pkg:github/actions/javascript-action",
    vers: "vers:semver/<2.0.0",
    event: "end-of-support",
    title: "Unsupported actions/javascript-action runtime",
    summary:
      "v1 sets runs.using to node12. GitHub removed Node.js 12 from Actions runners on 2023-08-14. No later major is published.",
    severity: "high",
    replacement: "No supported major of actions/javascript-action is published",
    deadline: "2023-08-14",
    sources: [
      {
        title: "Removal of Node12 from the Actions runner",
        url: "https://github.blog/changelog/2023-07-16-github-actions-removal-of-node12-from-the-actions-runner/",
        accessedAt: "2026-11-15",
      },
      {
        title: "actions/javascript-action v1 action.yml",
        url: "https://github.com/actions/javascript-action/blob/v1/action.yml",
        accessedAt: "2026-11-15",
      },
    ],
    provenance: {
      observedAt: "2026-11-15",
      reviewedAt: "2026-11-15",
      reviewer: "unreviewed",
      reviewers: ["unreviewed"],
      method: "manual",
    },
    migration: {
      constraints: [
        "This repository is a starter template. v1 is the only published major and it sets runs.using to node12.",
      ],
      steps: [
        {
          id: "stop-using-retired-major",
          title: "Stop pinning v1",
          instructions:
            "Do not pin actions/javascript-action@v1. Copy the template and set runs.using to node24 before publishing a workflow that uses it.",
          targets: "declaration",
        },
      ],
      verification: [{ command: "git diff --check", purpose: "Validate the edited workflow diff." }],
    },
    "x-github-actions": { action: "actions/javascript-action" },
  },
] as const;

export const data: RegistryV2 = {
  schemaVersion: "ebb.registry.v2",
  ecosystem: "github-actions",

  rules: [...rules],
};

export default rules;
