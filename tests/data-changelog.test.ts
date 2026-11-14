import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

import {
  formatChangelogSection,
  generateAtomFeed,
  prependChangelogEntry,
  type ChangelogRelease,
} from "../tools/data-changelog.js";
import { diffRules } from "../src/diff.js";
import type { RegistryV2Rule } from "../src/registry.js";

const sampleFromRules: RegistryV2Rule[] = [
  {
    id: "npm.package.request.deprecated",
    purl: "pkg:npm/request",
    ecosystem: "npm",
    event: "deprecated",
    vers: "vers:npm/*",
    title: "request package deprecation",
    summary: "Deprecated",
    severity: "medium",
    sources: [{ title: "request deprecation", url: "https://www.npmjs.com/package/request" }],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-10-13",
      reviewer: "arminazimi",
      method: "manual",
    },
  },
  {
    id: "nodejs.runtime.eol-18",
    purl: "pkg:generic/nodejs",
    ecosystem: "nodejs",
    event: "end-of-life",
    vers: "vers:npm/>=18.0.0|<19.0.0",
    deadline: "2025-04-30",
    title: "Node.js 18 end-of-life",
    summary: "EOL",
    severity: "high",
    sources: [{ title: "Node.js schedule", url: "https://nodejs.org" }],
    provenance: {
      observedAt: "2026-10-15",
      reviewedAt: "2026-10-15",
      reviewer: "maintainer1",
      method: "manual",
    },
  },
];

const sampleToRules: RegistryV2Rule[] = [
  {
    id: "npm.package.request.deprecated",
    purl: "pkg:npm/request",
    ecosystem: "npm",
    event: "deprecated",
    vers: "vers:npm/*",
    title: "request package deprecation",
    summary: "Deprecated",
    severity: "medium",
    replacement: "pkg:npm/undici",
    sources: [{ title: "request deprecation", url: "https://www.npmjs.com/package/request" }],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-11-14",
      reviewer: "arminazimi",
      method: "manual",
    },
  },
  {
    id: "nodejs.runtime.eol-18",
    purl: "pkg:generic/nodejs",
    ecosystem: "nodejs",
    event: "end-of-life",
    vers: "vers:npm/>=18.0.0|<19.0.0",
    deadline: "2025-05-30", // shifted 30 days
    title: "Node.js 18 end-of-life",
    summary: "EOL",
    severity: "high",
    sources: [{ title: "Node.js schedule", url: "https://nodejs.org" }],
    provenance: {
      observedAt: "2026-10-15",
      reviewedAt: "2026-10-15",
      reviewer: "maintainer1",
      method: "manual",
    },
  },
  {
    id: "npm.package.left-pad.deprecated",
    purl: "pkg:npm/left-pad",
    ecosystem: "npm",
    event: "deprecated",
    vers: "vers:npm/*",
    title: "left-pad unpublish",
    summary: "Unpublished",
    severity: "high",
    sources: [{ title: "left-pad", url: "https://www.npmjs.com/package/left-pad" }],
    provenance: {
      observedAt: "2026-11-14",
      reviewedAt: "2026-11-14",
      reviewer: "contributor2",
      method: "manual",
    },
  },
];

describe("data-changelog: section formatter", () => {
  it("formats summary and groups rules by ecosystem with contributor and PR attribution", () => {
    const diffResult = diffRules(sampleFromRules, sampleToRules);
    const section = formatChangelogSection(diffResult, {
      version: "0.4.0",
      date: "2026-11-14",
      pullRequest: 360,
    });

    assert.match(section, /## \[0\.4\.0\] - 2026-11-14/);
    assert.match(section, /### Summary/);
    assert.match(section, /- \*\*Added:\*\* 1 rule/);
    assert.match(section, /- \*\*Changed:\*\* 2 rules/);
    assert.match(section, /- \*\*Removed:\*\* 0 rules/);

    // npm ecosystem group
    assert.match(section, /### npm/);
    assert.match(section, /- \*\*Added\*\* `npm\.package\.left-pad\.deprecated`.*by @contributor2 in \[#360\]/);
    assert.match(section, /- \*\*Changed\*\* `npm\.package\.request\.deprecated`.*by @arminazimi in \[#360\]/);

    // nodejs ecosystem group
    assert.match(section, /### nodejs/);
    assert.match(section, /- \*\*Changed\*\* `nodejs\.runtime\.eol-18`.*deadline extended by 30 days.*by @maintainer1/);
  });
});

describe("data-changelog: entry prepending", () => {
  it("prepends release entry after the main heading in existing changelog", () => {
    const existing = "# Ebb Lifecycle Data Changelog\n\nIntro text.\n\n## [0.3.0] - 2026-11-13\n\n- Past items.\n";
    const newEntry = "## [0.4.0] - 2026-11-14\n\n- New items.";
    const result = prependChangelogEntry(existing, newEntry);

    assert.match(
      result,
      /^# Ebb Lifecycle Data Changelog\n\n## \[0\.4\.0\] - 2026-11-14\n\n- New items\.\n\nIntro text\./,
    );
  });
});

describe("data-changelog: atom feed generator", () => {
  it("produces valid Atom XML containing entries and metadata", () => {
    const releases: ChangelogRelease[] = [
      {
        version: "0.4.0",
        date: "2026-11-14",
        summary: "Release 0.4.0 summary",
        content: "<p>Release 0.4.0 html content</p>",
        author: "arminazimi",
      },
    ];

    const xml = generateAtomFeed(releases);
    assert.match(xml, /<\?xml version="1.0" encoding="utf-8"\?>/);
    assert.match(xml, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
    assert.match(xml, /<title>Ebb Lifecycle Data Changelog<\/title>/);
    assert.match(xml, /<id>tag:velella\.sh,2026-11-14:ebb:data-release:0\.4\.0<\/id>/);
    assert.match(xml, /<summary type="text">Release 0\.4\.0 summary<\/summary>/);
    assert.match(xml, /<content type="html"><!\[CDATA\[<p>Release 0\.4\.0 html content<\/p>\]\]><\/content>/);
    assert.match(xml, /<name>arminazimi<\/name>/);
  });
});

describe("data-changelog: CLI script execution", () => {
  it("runs tools/data-changelog.ts via Node subprocess and writes files", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ebb-changelog-test-"));
    const outMd = join(tmp, "CHANGELOG.md");
    const outFeed = join(tmp, "feed.atom");

    try {
      execFileSync(
        process.execPath,
        [
          "dist/tools/data-changelog.js",
          "--from",
          "bundled",
          "--to",
          "active",
          "--version",
          "0.4.0-test",
          "--date",
          "2026-11-14",
          "--pr",
          "360",
          "--out-md",
          outMd,
          "--out-feed",
          outFeed,
        ],
        { cwd: resolve("."), encoding: "utf8" },
      );

      const mdContent = await readFile(outMd, "utf8");
      assert.match(mdContent, /## \[0\.4\.0-test\] - 2026-11-14/);
      assert.match(mdContent, /### Summary/);

      const feedContent = await readFile(outFeed, "utf8");
      assert.match(feedContent, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
      assert.match(feedContent, /0\.4\.0-test/);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
