import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { buildDataBundle, canonicalJson, serializeDataBundle } from "../src/data-bundle.js";
import { DataSignatureError } from "../src/data-signature.js";
import { configureActiveData, resolveActiveData, resolveActiveDataSync } from "../src/data-source.js";
import { DATA_STATUS_SCHEMA_VERSION, dataInfoFrom, dataStatusFrom, getDataStatus } from "../src/data-status.js";
import {
  compareBundleVersions,
  DATA_UPDATE_SCHEMA_VERSION,
  DataUpdateError,
  latestDataRelease,
  RELEASES_ETAG_FILE,
  rollback,
  update,
  updateData,
  writeAtomically,
} from "../src/data-update.js";
import { addDays } from "../src/upcoming.js";
import { VERSION } from "../src/version.js";

const SIGNER = { identity: "ci@example.com", issuer: "https://token.actions.githubusercontent.com" };
const verifySignature = () => SIGNER;

let workspace = "";
let fixtureRepo = "";
let mutatedRepo = "";

before(async () => {
  workspace = await mkdtemp(join(tmpdir(), "ebb-data-update-"));
  fixtureRepo = join(workspace, "repo-a");
  mutatedRepo = join(workspace, "repo-b");
  await cp(resolve("registry"), join(fixtureRepo, "registry"), { recursive: true });
  await writeFile(join(fixtureRepo, "package.json"), await readFile(resolve("package.json"), "utf8"));
  await cp(fixtureRepo, mutatedRepo, { recursive: true });

  const npmPath = join(mutatedRepo, "registry", "npm.json");
  const npm = JSON.parse(await readFile(npmPath, "utf8")) as { rules: Array<Record<string, unknown>> };
  npm.rules.push({
    id: "npm.package.ebb-update-probe.deprecated",
    ecosystem: "npm",
    purl: "pkg:npm/ebb-update-probe",
    vers: "vers:npm/*",
    event: "deprecated",
    title: "ebb-update-probe deprecated",
    summary: "Synthetic rule to yield a distinct contentDigest.",
    severity: "low",
    sources: [{ title: "test", url: "https://example.com/probe", accessedAt: "2099-01-01" }],
    provenance: { observedAt: "2099-01-01", reviewedAt: "2099-01-01", reviewer: "test", method: "manual" },
    "x-npm": { package: "ebb-update-probe" },
  });
  await writeFile(npmPath, `${JSON.stringify(npm)}\n`);
});

after(async () => {
  configureActiveData({});
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

function mockFetch(routes: Record<string, () => Response | Promise<Response>>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const handler = routes[url];
    if (!handler) throw new Error(`Unexpected URL: ${url}`);
    return await handler();
  }) as typeof fetch;
}

function releasesFor(
  version: string,
  baseUrl = "https://example.com",
): Array<{
  tag_name: string;
  draft: boolean;
  assets: Array<{ name: string; browser_download_url: string }>;
}> {
  return [
    {
      tag_name: `data-v${version}`,
      draft: false,
      assets: [
        { name: `ebb-data-${version}.json`, browser_download_url: `${baseUrl}/bundle-${version}.json` },
        {
          name: `ebb-data-${version}.json.sigstore.json`,
          browser_download_url: `${baseUrl}/bundle-${version}.sigstore.json`,
        },
      ],
    },
  ];
}

test("compareBundleVersions orders dates and same-day revisions numerically", () => {
  assert.equal(compareBundleVersions("2026.10.16", "2026.10.16"), 0);
  assert.ok(compareBundleVersions("2026.10.16", "2026.10.16.2") < 0);
  assert.ok(compareBundleVersions("2026.10.16.2", "2026.10.16") > 0);
  assert.ok(compareBundleVersions("2026.10.17", "2026.10.16.9") > 0);
  // data-release-3: orders unadorned date, same-day revision .1, and next day correctly
  assert.ok(compareBundleVersions("2026.11.20", "2026.11.20.1") < 0);
  assert.ok(compareBundleVersions("2026.11.20.1", "2026.11.21") < 0);
  assert.ok(compareBundleVersions("2026.11.20", "2026.11.21") < 0);
  const versions = ["2026.11.21", "2026.11.20", "2026.11.20.1"];
  versions.sort(compareBundleVersions);
  assert.deepEqual(versions, ["2026.11.20", "2026.11.20.1", "2026.11.21"]);
});

test("latestDataRelease skips drafts, non-data tags, and incomplete releases", () => {
  const releases = [
    { tag_name: "v0.1.0", assets: [] },
    {
      tag_name: "data-v2026.10.20",
      draft: true,
      assets: [
        { name: "ebb-data-2026.10.20.json", browser_download_url: "https://example.com/draft.json" },
        { name: "ebb-data-2026.10.20.json.sigstore.json", browser_download_url: "https://example.com/draft.sig" },
      ],
    },
    {
      tag_name: "data-v2026.10.19",
      assets: [{ name: "ebb-data-2026.10.19.json", browser_download_url: "https://example.com/nosig.json" }],
    },
    ...releasesFor("2026.10.16"),
    ...releasesFor("2026.10.16.2"),
  ];

  assert.equal(latestDataRelease(releases)?.version, "2026.10.16.2");
  assert.equal(latestDataRelease(releases, "2026.10.16")?.version, "2026.10.16");
  assert.equal(latestDataRelease(releases, "2026.10.99"), undefined);
});

test("updateData rejects malformed versions, invalid URLs, download errors, and bad signatures", async () => {
  const cache = await mkdtemp(join(workspace, "err-cache-"));
  const baseUrl = "https://example.com";
  const releasesUrl = `${baseUrl}/releases.json`;

  await assert.rejects(
    () => updateData({ version: "latest", cacheDirectory: cache, fetch: mockFetch({}) }),
    (error: unknown) => error instanceof DataUpdateError && /is not a data version/.test(error.message),
  );
  await assert.rejects(
    () => updateData({ releasesUrl: "not-a-url", cacheDirectory: cache, fetch: mockFetch({}) }),
    (error: unknown) => error instanceof DataUpdateError && /is not a valid URL/.test(error.message),
  );
  await assert.rejects(
    () => updateData({ releasesUrl: "http://example.com/releases.json", cacheDirectory: cache, fetch: mockFetch({}) }),
    (error: unknown) => error instanceof DataUpdateError && /must use https/.test(error.message),
  );

  // Network error with cause and without cause (loopback http allowed)
  await assert.rejects(
    () =>
      updateData({
        releasesUrl: "http://127.0.0.1/releases.json",
        cacheDirectory: cache,
        fetch: () => Promise.reject(new Error("connect failed", { cause: new Error("ECONNREFUSED") })),
      }),
    (error: unknown) => error instanceof DataUpdateError && /ECONNREFUSED/.test(error.message),
  );
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        fetch: () => Promise.reject(new Error("timed out")),
      }),
    (error: unknown) => error instanceof DataUpdateError && /timed out/.test(error.message),
  );

  // HTTP status, declared oversized header, invalid JSON, non-array JSON, missing release
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        fetch: mockFetch({ [releasesUrl]: () => new Response("down", { status: 503 }) }),
      }),
    (error: unknown) => error instanceof DataUpdateError && /HTTP 503/.test(error.message),
  );
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        fetch: mockFetch({
          [releasesUrl]: () =>
            new Response("[]", { status: 200, headers: { "content-length": String(5 * 1024 * 1024) } }),
        }),
      }),
    (error: unknown) => error instanceof DataUpdateError && /larger than the/.test(error.message),
  );
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        fetch: mockFetch({ [releasesUrl]: () => new Response("{bad", { status: 200 }) }),
      }),
    (error: unknown) => error instanceof DataUpdateError && /not valid JSON/.test(error.message),
  );
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        fetch: mockFetch({ [releasesUrl]: () => new Response("{}", { status: 200 }) }),
      }),
    (error: unknown) => error instanceof DataUpdateError && /not valid JSON/.test(error.message),
  );
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        version: "2099.01.02",
        cacheDirectory: cache,
        fetch: mockFetch({ [releasesUrl]: () => new Response("[]", { status: 200 }) }),
      }),
    (error: unknown) => error instanceof DataUpdateError && /No signed data release 2099\.01\.02/.test(error.message),
  );
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        fetch: mockFetch({ [releasesUrl]: () => new Response("[]", { status: 200 }) }),
      }),
    (error: unknown) => error instanceof DataUpdateError && /No signed data release was found/.test(error.message),
  );

  // Oversized streamed chunk without content-length header
  const bundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2099-02-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const serialized = serializeDataBundle(bundle);
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        fetch: mockFetch({
          [releasesUrl]: () => new Response(JSON.stringify(releasesFor("2099.02.01")), { status: 200 }),
          [`${baseUrl}/bundle-2099.02.01.json`]: () => new Response(serialized, { status: 200 }),
          [`${baseUrl}/bundle-2099.02.01.sigstore.json`]: () =>
            new Response(Buffer.alloc(1024 * 1024 + 16, 65), { status: 200 }),
        }),
      }),
    (error: unknown) => error instanceof DataUpdateError && /larger than the/.test(error.message),
  );

  // Signature error, non-bundle unexpected error, and manifest version mismatch
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        verifySignature: () => {
          throw new DataSignatureError("bad sig");
        },
        fetch: mockFetch({
          [releasesUrl]: () => new Response(JSON.stringify(releasesFor("2099.02.01")), { status: 200 }),
          [`${baseUrl}/bundle-2099.02.01.json`]: () => new Response(serialized, { status: 200 }),
          [`${baseUrl}/bundle-2099.02.01.sigstore.json`]: () => new Response("{}", { status: 200 }),
        }),
      }),
    (error: unknown) =>
      error instanceof DataUpdateError && /Refusing data bundle 2099\.02\.01: bad sig/.test(error.message),
  );
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        verifySignature: () => {
          throw new Error("boom");
        },
        fetch: mockFetch({
          [releasesUrl]: () => new Response(JSON.stringify(releasesFor("2099.02.01")), { status: 200 }),
          [`${baseUrl}/bundle-2099.02.01.json`]: () => new Response(serialized, { status: 200 }),
          [`${baseUrl}/bundle-2099.02.01.sigstore.json`]: () => new Response("{}", { status: 200 }),
        }),
      }),
    /boom/,
  );

  const mismatchedBundle = { ...bundle, manifest: { ...bundle.manifest, version: "2099.02.01" } };
  await assert.rejects(
    () =>
      updateData({
        releasesUrl,
        cacheDirectory: cache,
        verifySignature,
        fetch: mockFetch({
          [releasesUrl]: () => new Response(JSON.stringify(releasesFor("2099.02.02")), { status: 200 }),
          [`${baseUrl}/bundle-2099.02.02.json`]: () =>
            new Response(`${canonicalJson(mismatchedBundle)}\n`, { status: 200 }),
          [`${baseUrl}/bundle-2099.02.02.sigstore.json`]: () => new Response("{}", { status: 200 }),
        }),
      }),
    (error: unknown) => error instanceof DataUpdateError && /says it is version 2099\.02\.01/.test(error.message),
  );
});

test("updateData handles up-to-date, downloaded pin, updated, downgrade guard, and cache pruning", async () => {
  const cache = await mkdtemp(join(workspace, "ok-cache-"));
  const baseUrl = "https://example.com";
  const releasesUrl = `${baseUrl}/releases.json`;

  const oldBundled = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2020-01-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const newerBundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2099-02-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const sameDigestBundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2099-02-05T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const olderDistinctBundle = await buildDataBundle({
    root: mutatedRepo,
    createdAt: "2099-01-15T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const newestDistinctBundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2099-03-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });

  // 1. Remote bundle not newer than bundled -> up-to-date
  const bundledUpToDate = await updateData({
    cacheDirectory: cache,
    releasesUrl,
    ebbVersion: VERSION,
    verifySignature,
    fetch: mockFetch({
      [releasesUrl]: () => new Response(JSON.stringify(releasesFor(oldBundled.manifest.version)), { status: 200 }),
      [`${baseUrl}/bundle-${oldBundled.manifest.version}.json`]: () =>
        new Response(serializeDataBundle(oldBundled), { status: 200 }),
      [`${baseUrl}/bundle-${oldBundled.manifest.version}.sigstore.json`]: () => new Response("{}", { status: 200 }),
    }),
  });
  assert.equal(bundledUpToDate.schemaVersion, DATA_UPDATE_SCHEMA_VERSION);
  assert.equal(bundledUpToDate.status, "up-to-date");
  assert.equal(bundledUpToDate.from.source, "bundled");
  assert.equal(bundledUpToDate.createdAt, null);

  // 2. Newer bundle updates cache and sets active pointer
  const firstUpdate = await updateData({
    cacheDirectory: cache,
    releasesUrl,
    ebbVersion: VERSION,
    verifySignature,
    fetch: mockFetch({
      [releasesUrl]: () => new Response(JSON.stringify(releasesFor(newerBundle.manifest.version)), { status: 200 }),
      [`${baseUrl}/bundle-${newerBundle.manifest.version}.json`]: () =>
        new Response(serializeDataBundle(newerBundle), { status: 200 }),
      [`${baseUrl}/bundle-${newerBundle.manifest.version}.sigstore.json`]: () => new Response("{}", { status: 200 }),
    }),
  });
  assert.equal(firstUpdate.status, "updated");
  assert.equal(firstUpdate.from.source, "bundled");
  assert.equal(firstUpdate.to.source, "cache");
  assert.equal(firstUpdate.to.version, "2099.02.01");

  // 3. Cached contentDigest match returns up-to-date without rewriting cache
  const cacheUpToDate = await updateData({
    cacheDirectory: cache,
    releasesUrl,
    ebbVersion: VERSION,
    verifySignature,
    fetch: mockFetch({
      [releasesUrl]: () =>
        new Response(JSON.stringify(releasesFor(sameDigestBundle.manifest.version)), { status: 200 }),
      [`${baseUrl}/bundle-${sameDigestBundle.manifest.version}.json`]: () =>
        new Response(serializeDataBundle(sameDigestBundle), { status: 200 }),
      [`${baseUrl}/bundle-${sameDigestBundle.manifest.version}.sigstore.json`]: () =>
        new Response("{}", { status: 200 }),
    }),
  });
  assert.equal(cacheUpToDate.status, "up-to-date");
  assert.equal(cacheUpToDate.to.version, "2099.02.01");
  assert.deepEqual(cacheUpToDate.signer, SIGNER);

  // 4. Exact version download returns status "downloaded" without switching active.json
  const pinnedDownload = await updateData({
    cacheDirectory: cache,
    releasesUrl,
    version: olderDistinctBundle.manifest.version,
    ebbVersion: VERSION,
    verifySignature,
    fetch: mockFetch({
      [releasesUrl]: () =>
        new Response(JSON.stringify(releasesFor(olderDistinctBundle.manifest.version)), { status: 200 }),
      [`${baseUrl}/bundle-${olderDistinctBundle.manifest.version}.json`]: () =>
        new Response(serializeDataBundle(olderDistinctBundle), { status: 200 }),
      [`${baseUrl}/bundle-${olderDistinctBundle.manifest.version}.sigstore.json`]: () =>
        new Response("{}", { status: 200 }),
    }),
  });
  assert.equal(pinnedDownload.status, "downloaded");
  assert.deepEqual(pinnedDownload.to, { source: "pinned", version: "2099.01.15" });

  // 5. Older bundle with different contentDigest is refused without allowDowngrade, and allowed with it
  await assert.rejects(
    () =>
      updateData({
        cacheDirectory: cache,
        releasesUrl,
        ebbVersion: VERSION,
        verifySignature,
        fetch: mockFetch({
          [releasesUrl]: () =>
            new Response(JSON.stringify(releasesFor(olderDistinctBundle.manifest.version)), { status: 200 }),
          [`${baseUrl}/bundle-${olderDistinctBundle.manifest.version}.json`]: () =>
            new Response(serializeDataBundle(olderDistinctBundle), { status: 200 }),
          [`${baseUrl}/bundle-${olderDistinctBundle.manifest.version}.sigstore.json`]: () =>
            new Response("{}", { status: 200 }),
        }),
      }),
    (error: unknown) => error instanceof DataUpdateError && /roll the rules back/.test(error.message),
  );

  const downgraded = await updateData({
    cacheDirectory: cache,
    releasesUrl,
    ebbVersion: VERSION,
    allowDowngrade: true,
    verifySignature,
    fetch: mockFetch({
      [releasesUrl]: () =>
        new Response(JSON.stringify(releasesFor(olderDistinctBundle.manifest.version)), { status: 200 }),
      [`${baseUrl}/bundle-${olderDistinctBundle.manifest.version}.json`]: () =>
        new Response(serializeDataBundle(olderDistinctBundle), { status: 200 }),
      [`${baseUrl}/bundle-${olderDistinctBundle.manifest.version}.sigstore.json`]: () =>
        new Response("{}", { status: 200 }),
    }),
  });
  assert.equal(downgraded.status, "updated");
  assert.equal(downgraded.to.version, "2099.01.15");

  // 6. Newer distinct bundle prunes stale cached directories beyond KEEP_VERSIONS (3)
  await mkdir(join(cache, "data", "2098.01.01"), { recursive: true });
  const secondUpdate = await updateData({
    cacheDirectory: cache,
    releasesUrl,
    ebbVersion: VERSION,
    verifySignature,
    fetch: mockFetch({
      [releasesUrl]: () =>
        new Response(JSON.stringify(releasesFor(newestDistinctBundle.manifest.version)), { status: 200 }),
      [`${baseUrl}/bundle-${newestDistinctBundle.manifest.version}.json`]: () =>
        new Response(serializeDataBundle(newestDistinctBundle), { status: 200 }),
      [`${baseUrl}/bundle-${newestDistinctBundle.manifest.version}.sigstore.json`]: () =>
        new Response("{}", { status: 200 }),
    }),
  });
  assert.equal(secondUpdate.status, "updated");
  assert.equal(secondUpdate.to.version, "2099.03.01");
  assert.equal(secondUpdate.rules.npm!.after, secondUpdate.rules.npm!.before! - 1);

  const entries = (await readdir(join(cache, "data"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.equal(entries.length, 3);
  assert.deepEqual(entries, ["2099.01.15", "2099.02.01", "2099.03.01"]);
});

test("dataStatusFrom, dataInfoFrom, and getDataStatus compute ageDays and staleness", async () => {
  const bundled = await resolveActiveData({ cacheDirectory: join(workspace, "no-such-cache") });
  const freshStatus = dataStatusFrom(bundled, new Date(`${bundled.info.reviewedThrough}T12:00:00Z`), "/tmp/cache");
  assert.equal(freshStatus.schemaVersion, DATA_STATUS_SCHEMA_VERSION);
  assert.equal(freshStatus.ageBasis, "reviewedThrough");
  assert.equal(freshStatus.ageDays, 0);
  assert.equal(freshStatus.stale, false);
  assert.equal(freshStatus.cacheDirectory, "/tmp/cache");

  const staleNow = new Date(Date.parse(`${bundled.info.reviewedThrough}T00:00:00Z`) + 35 * 86_400_000);
  const info = dataInfoFrom(bundled, staleNow);
  assert.equal(info.stale, true);
  assert.equal(info.ageDays, 35);

  const syntheticInvalid = { ...bundled, info: { ...bundled.info, createdAt: null, reviewedThrough: "not-a-date" } };
  assert.equal(dataStatusFrom(syntheticInvalid, staleNow).ageDays, 0);

  const syntheticCached = {
    ...bundled,
    info: { ...bundled.info, source: "cache" as const, createdAt: "2026-04-01T00:00:00Z", contentDigest: "sha256:00" },
  };
  const cacheStatus = dataStatusFrom(syntheticCached, new Date("2026-04-11T00:00:00Z"));
  assert.equal(cacheStatus.ageBasis, "createdAt");
  assert.equal(cacheStatus.ageDays, 10);

  configureActiveData({ cacheDirectory: join(workspace, "no-such-cache") });
  const activeStatus = await getDataStatus(staleNow);
  assert.equal(activeStatus.source, "bundled");
  assert.equal(activeStatus.stale, true);
  configureActiveData({});
});

test("update() supports check mode, channel selection, and summary delta", async () => {
  const cache = await mkdtemp(join(workspace, "check-cache-"));
  const baseUrl = "https://example.com";
  const releasesUrl = `${baseUrl}/releases.json`;

  const stableRelease = {
    tag_name: "data-v2099.04.01",
    draft: false,
    prerelease: false,
    assets: [
      { name: "ebb-data-2099.04.01.json", browser_download_url: `${baseUrl}/bundle-stable.json` },
      { name: "ebb-data-2099.04.01.json.sigstore.json", browser_download_url: `${baseUrl}/sig-stable.json` },
    ],
  };

  const nextRelease = {
    tag_name: "data-v2099.05.01-next.1",
    draft: false,
    prerelease: true,
    assets: [
      { name: "ebb-data-2099.05.01-next.1.json", browser_download_url: `${baseUrl}/bundle-next.json` },
      { name: "ebb-data-2099.05.01-next.1.json.sigstore.json", browser_download_url: `${baseUrl}/sig-next.json` },
    ],
  };

  const releases = [stableRelease, nextRelease];

  // Channel "stable" ignores the prerelease
  assert.equal(latestDataRelease(releases, undefined, "stable")?.version, "2099.04.01");
  // Channel "next" selects the newer prerelease
  assert.equal(latestDataRelease(releases, undefined, "next")?.version, "2099.05.01-next.1");

  // check: true checks if update is available without downloading bundle or modifying cache
  const checkResult = await update({
    check: true,
    cacheDirectory: cache,
    releasesUrl,
    ebbVersion: VERSION,
    fetch: mockFetch({
      [releasesUrl]: () => new Response(JSON.stringify(releases), { status: 200 }),
    }),
  });
  assert.equal(checkResult.status, "update-available");
  assert.equal(checkResult.to.version, "2099.04.01");
  assert.ok(checkResult.summary);

  // Cache remains empty
  const entries = await readdir(cache);
  assert.deepEqual(entries, []);
});

test("rollback() reverts to previous cached version and back to bundled data", async () => {
  const cache = await mkdtemp(join(workspace, "rollback-cache-"));
  const baseUrl = "https://example.com";
  const releasesUrl = `${baseUrl}/releases.json`;

  const bundle1 = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2099-01-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const bundle2 = await buildDataBundle({
    root: mutatedRepo,
    createdAt: "2099-02-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });

  // Rollback on bundled data throws error
  await assert.rejects(
    () => rollback({ cacheDirectory: cache }),
    (err: unknown) => err instanceof DataUpdateError && /Cannot roll back/.test(err.message),
  );

  // Install version 1
  await update({
    cacheDirectory: cache,
    releasesUrl,
    ebbVersion: VERSION,
    verifySignature,
    fetch: mockFetch({
      [releasesUrl]: () => new Response(JSON.stringify(releasesFor(bundle1.manifest.version)), { status: 200 }),
      [`${baseUrl}/bundle-${bundle1.manifest.version}.json`]: () =>
        new Response(serializeDataBundle(bundle1), { status: 200 }),
      [`${baseUrl}/bundle-${bundle1.manifest.version}.sigstore.json`]: () => new Response("{}", { status: 200 }),
    }),
  });

  // Install version 2
  await update({
    cacheDirectory: cache,
    releasesUrl,
    ebbVersion: VERSION,
    verifySignature,
    fetch: mockFetch({
      [releasesUrl]: () => new Response(JSON.stringify(releasesFor(bundle2.manifest.version)), { status: 200 }),
      [`${baseUrl}/bundle-${bundle2.manifest.version}.json`]: () =>
        new Response(serializeDataBundle(bundle2), { status: 200 }),
      [`${baseUrl}/bundle-${bundle2.manifest.version}.sigstore.json`]: () => new Response("{}", { status: 200 }),
    }),
  });

  // Active data is version 2
  const activeNow = await resolveActiveData({ cacheDirectory: cache, verifySignature });
  assert.equal(activeNow.info.version, "2099.02.01");

  // Rollback 1: version 2 -> version 1
  const rolled1 = await rollback({ cacheDirectory: cache, verifySignature });
  assert.equal(rolled1.status, "rolled-back");
  assert.equal(rolled1.from.version, "2099.02.01");
  assert.equal(rolled1.to.version, "2099.01.01");
  assert.equal(rolled1.to.source, "cache");

  // Rollback 2: version 1 -> bundled
  const rolled2 = await rollback({ cacheDirectory: cache, verifySignature });
  assert.equal(rolled2.status, "rolled-back");
  assert.equal(rolled2.from.version, "2099.01.01");
  assert.equal(rolled2.to.source, "bundled");

  // Further rollback throws
  await assert.rejects(
    () => rollback({ cacheDirectory: cache, verifySignature }),
    (err: unknown) => err instanceof DataUpdateError && /Cannot roll back/.test(err.message),
  );
});

test("update() with a local HTTP server downloads and applies update atomically", async () => {
  const cache = await mkdtemp(join(workspace, "server-cache-"));
  const bundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2099-06-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const serialized = serializeDataBundle(bundle);

  const server = http.createServer((req, res) => {
    if (req.url === "/releases.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify([
          {
            tag_name: "data-v2099.06.01",
            assets: [
              { name: "ebb-data-2099.06.01.json", browser_download_url: `http://127.0.0.1:${port}/bundle.json` },
              {
                name: "ebb-data-2099.06.01.json.sigstore.json",
                browser_download_url: `http://127.0.0.1:${port}/bundle.sigstore.json`,
              },
            ],
          },
        ]),
      );
    } else if (req.url === "/bundle.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(serialized);
    } else if (req.url === "/bundle.sigstore.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    } else {
      res.writeHead(404).end();
    }
  });

  await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
  const port = (server.address() as AddressInfo).port;

  try {
    const result = await update({
      cacheDirectory: cache,
      releasesUrl: `http://127.0.0.1:${port}/releases.json`,
      verifySignature,
    });
    assert.equal(result.status, "updated");
    assert.equal(result.to.version, "2099.06.01");
  } finally {
    server.close();
  }
});

test("update() aborts cleanly on failed download midway leaving cache unchanged", async () => {
  const cache = await mkdtemp(join(workspace, "midway-cache-"));
  const server = http.createServer((req, res) => {
    if (req.url === "/releases.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify([
          {
            tag_name: "data-v2099.07.01",
            assets: [
              { name: "ebb-data-2099.07.01.json", browser_download_url: `http://127.0.0.1:${port}/bundle.json` },
              {
                name: "ebb-data-2099.07.01.json.sigstore.json",
                browser_download_url: `http://127.0.0.1:${port}/bundle.sigstore.json`,
              },
            ],
          },
        ]),
      );
    } else if (req.url === "/bundle.json") {
      // Send partial body and abruptly destroy connection
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"manifest":');
      res.destroy();
    } else {
      res.writeHead(404).end();
    }
  });

  await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
  const port = (server.address() as AddressInfo).port;

  try {
    await assert.rejects(
      () =>
        update({
          cacheDirectory: cache,
          releasesUrl: `http://127.0.0.1:${port}/releases.json`,
          verifySignature,
        }),
      (err: unknown) => err instanceof DataUpdateError && /Could not download/.test(err.message),
    );

    // Verify cache directory has no partial active file or bundle
    const active = await resolveActiveData({ cacheDirectory: cache });
    assert.equal(active.info.source, "bundled");
  } finally {
    server.close();
  }
});

test("EBB_OFFLINE=1 blocks update() before any network request", async () => {
  const prev = process.env.EBB_OFFLINE;
  try {
    process.env.EBB_OFFLINE = "1";
    let fetchCalled = false;
    const failingFetch = (() => {
      fetchCalled = true;
      throw new Error("Network request was attempted!");
    }) as unknown as typeof fetch;

    await assert.rejects(
      () => update({ fetch: failingFetch }),
      (err: unknown) => {
        assert(err instanceof DataUpdateError);
        assert.equal(err.code, "offline");
        assert.ok(err.suggestedStep);
        return true;
      },
    );
    assert.equal(fetchCalled, false, "fetch must not be called when offline");
  } finally {
    if (prev === undefined) delete process.env.EBB_OFFLINE;
    else process.env.EBB_OFFLINE = prev;
  }
});

test("update({ offline: true }) blocks network requests", async () => {
  let fetchCalled = false;
  const failingFetch = (() => {
    fetchCalled = true;
    throw new Error("Network request was attempted!");
  }) as unknown as typeof fetch;

  await assert.rejects(
    () => update({ offline: true, fetch: failingFetch }),
    (err: unknown) => {
      assert(err instanceof DataUpdateError);
      assert.equal(err.code, "offline");
      return true;
    },
  );
  assert.equal(fetchCalled, false);
});

test("update() classifies no-network failure and provides suggested next step with at most 1 retry", async () => {
  let callCount = 0;
  const failingFetch = (() => {
    callCount++;
    const err = new Error("connect ECONNREFUSED 127.0.0.1:443");
    // @ts-expect-error test error code
    err.code = "ECONNREFUSED";
    throw err;
  }) as unknown as typeof fetch;

  const cache = await mkdtemp(join(workspace, "no-net-cache-"));
  await assert.rejects(
    () => update({ fetch: failingFetch, cacheDirectory: cache }),
    (err: unknown) => {
      assert(err instanceof DataUpdateError);
      assert.equal(err.code, "no-network");
      assert.ok(err.suggestedStep?.includes("Check your internet connection"));
      assert.ok(err.message.includes("Suggested next step:"));
      return true;
    },
  );
  assert.equal(callCount, 2, "must retry at most once on network failure");
  const active = await resolveActiveData({ cacheDirectory: cache });
  assert.equal(active.info.source, "bundled");
});

test("update() classifies DNS failure and provides suggested next step", async () => {
  let callCount = 0;
  const failingFetch = (() => {
    callCount++;
    const err = new Error("getaddrinfo ENOTFOUND api.github.com");
    // @ts-expect-error test error code
    err.code = "ENOTFOUND";
    throw err;
  }) as unknown as typeof fetch;

  const cache = await mkdtemp(join(workspace, "dns-cache-"));
  await assert.rejects(
    () => update({ fetch: failingFetch, cacheDirectory: cache }),
    (err: unknown) => {
      assert(err instanceof DataUpdateError);
      assert.equal(err.code, "dns-failure");
      assert.ok(err.suggestedStep?.includes("Check your DNS"));
      return true;
    },
  );
  assert.equal(callCount, 2);
  const active = await resolveActiveData({ cacheDirectory: cache });
  assert.equal(active.info.source, "bundled");
});

test("update() classifies proxy error and provides suggested next step", async () => {
  const failingFetch = (() => {
    const err = new Error("Proxy connection failed: ECONNRESET");
    // @ts-expect-error test error code
    err.code = "EPROXY";
    throw err;
  }) as unknown as typeof fetch;

  const cache = await mkdtemp(join(workspace, "proxy-cache-"));
  await assert.rejects(
    () => update({ fetch: failingFetch, cacheDirectory: cache }),
    (err: unknown) => {
      assert(err instanceof DataUpdateError);
      assert.equal(err.code, "proxy-error");
      assert.ok(err.suggestedStep?.includes("HTTP_PROXY"));
      return true;
    },
  );
  const active = await resolveActiveData({ cacheDirectory: cache });
  assert.equal(active.info.source, "bundled");
});

test("update() classifies rate limit (HTTP 429) and provides suggested next step", async () => {
  const failingFetch = (() => {
    return Promise.resolve(new Response("rate limited", { status: 429, statusText: "Too Many Requests" }));
  }) as unknown as typeof fetch;

  const cache = await mkdtemp(join(workspace, "rate-limit-cache-"));
  await assert.rejects(
    () => update({ fetch: failingFetch, cacheDirectory: cache }),
    (err: unknown) => {
      assert(err instanceof DataUpdateError);
      assert.equal(err.code, "rate-limited");
      assert.ok(err.suggestedStep?.includes("Wait before retrying"));
      return true;
    },
  );
  const active = await resolveActiveData({ cacheDirectory: cache });
  assert.equal(active.info.source, "bundled");
});

test("update({ from: bundleFile }) installs local bundle with rollback copy", async () => {
  const cache = await mkdtemp(join(workspace, "local-from-cache-"));
  const localDir = await mkdtemp(join(workspace, "bundle-files-"));

  const bundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2099-08-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const serialized = serializeDataBundle(bundle);
  const bundlePath = join(localDir, `ebb-data-${bundle.manifest.version}.json`);
  const sigPath = `${bundlePath}.sigstore.json`;
  await writeFile(bundlePath, serialized);
  await writeFile(sigPath, "{}");

  const result = await update({
    from: bundlePath,
    cacheDirectory: cache,
    verifySignature,
  });

  assert.equal(result.status, "updated");
  assert.equal(result.to.version, bundle.manifest.version);
  const active = await resolveActiveData({ cacheDirectory: cache, verifySignature });
  assert.equal(active.info.version, bundle.manifest.version);
  assert.equal(active.info.source, "cache");

  // Verify rollback copy exists and works
  const rollbackResult = await rollback({ cacheDirectory: cache, verifySignature });
  assert.equal(rollbackResult.status, "rolled-back");
  const afterRollback = await resolveActiveData({ cacheDirectory: cache, verifySignature });
  assert.equal(afterRollback.info.source, "bundled");
});

test("update({ from: bundleFile }) works even when EBB_OFFLINE=1", async () => {
  const prev = process.env.EBB_OFFLINE;
  try {
    process.env.EBB_OFFLINE = "1";
    const cache = await mkdtemp(join(workspace, "local-offline-cache-"));
    const localDir = await mkdtemp(join(workspace, "bundle-offline-files-"));

    const bundle = await buildDataBundle({
      root: fixtureRepo,
      createdAt: "2099-08-02T00:00:00Z",
      minimumEbbVersion: "0.0.1",
    });
    const serialized = serializeDataBundle(bundle);
    const bundlePath = join(localDir, `ebb-data-${bundle.manifest.version}.json`);
    const sigPath = `${bundlePath}.sigstore.json`;
    await writeFile(bundlePath, serialized);
    await writeFile(sigPath, "{}");

    const result = await update({
      from: bundlePath,
      cacheDirectory: cache,
      verifySignature,
    });
    assert.equal(result.status, "updated");
    assert.equal(result.to.version, bundle.manifest.version);
  } finally {
    if (prev === undefined) delete process.env.EBB_OFFLINE;
    else process.env.EBB_OFFLINE = prev;
  }
});

test("update({ from: bundleFile }) rejects tampered bundle leaving cache untouched", async () => {
  const cache = await mkdtemp(join(workspace, "tampered-from-cache-"));
  const localDir = await mkdtemp(join(workspace, "tampered-files-"));

  const bundlePath = join(localDir, "ebb-data-2099.08.03.json");
  const sigPath = `${bundlePath}.sigstore.json`;
  await writeFile(bundlePath, '{"manifest":{"version":"2099.08.03","contentDigest":"tampered"},"files":{}}');
  await writeFile(sigPath, "{}");

  await assert.rejects(
    () =>
      update({
        from: bundlePath,
        cacheDirectory: cache,
        verifySignature,
      }),
    (err: unknown) => err instanceof DataUpdateError && /Refusing data bundle/.test(err.message),
  );

  const active = await resolveActiveData({ cacheDirectory: cache });
  assert.equal(active.info.source, "bundled");
});

test("update({ from: bundleFile }) rejects bundle when signature file is missing", async () => {
  const cache = await mkdtemp(join(workspace, "missing-sig-cache-"));
  const localDir = await mkdtemp(join(workspace, "missing-sig-files-"));

  const bundlePath = join(localDir, "ebb-data-2099.08.04.json");
  await writeFile(bundlePath, '{"manifest":{"version":"2099.08.04"}}');

  await assert.rejects(
    () =>
      update({
        from: bundlePath,
        cacheDirectory: cache,
        verifySignature,
      }),
    (err: unknown) => err instanceof DataUpdateError && /Could not read signature file/.test(err.message),
  );

  const active = await resolveActiveData({ cacheDirectory: cache });
  assert.equal(active.info.source, "bundled");
});

test("update() reads releases from EBB_RELEASES_URL mirror and rejects re-signed bundle", async () => {
  const cache = await mkdtemp(join(workspace, "mirror-cache-"));
  const bundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2099-09-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const serialized = serializeDataBundle(bundle);
  const version = bundle.manifest.version;

  let serveTamperedSig = false;

  const server = http.createServer((req, res) => {
    if (req.url === "/mirror/releases.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify([
          {
            tag_name: `data-v${version}`,
            assets: [
              { name: `ebb-data-${version}.json`, browser_download_url: `http://127.0.0.1:${port}/bundle.json` },
              {
                name: `ebb-data-${version}.json.sigstore.json`,
                browser_download_url: `http://127.0.0.1:${port}/bundle.sigstore.json`,
              },
            ],
          },
        ]),
      );
    } else if (req.url === "/bundle.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(serialized);
    } else if (req.url === "/bundle.sigstore.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(serveTamperedSig ? '{"re-signed":"unauthorized"}' : "{}");
    } else {
      res.writeHead(404).end();
    }
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;

  const prevEnv = process.env.EBB_RELEASES_URL;
  try {
    process.env.EBB_RELEASES_URL = `http://127.0.0.1:${port}/mirror/releases.json`;

    // 1. Valid update from local mirror
    const result = await update({
      cacheDirectory: cache,
      verifySignature,
    });
    assert.equal(result.status, "updated");
    assert.equal(result.to.version, version);

    // 2. Reject re-signed / untrusted bundle from mirror
    serveTamperedSig = true;
    const failingVerifySig = () => {
      throw new DataSignatureError("Unauthorized signer: re-signed bundle is not trusted");
    };

    const cache2 = await mkdtemp(join(workspace, "mirror-untrusted-cache-"));
    await assert.rejects(
      () =>
        update({
          cacheDirectory: cache2,
          verifySignature: failingVerifySig,
        }),
      (err: unknown) => err instanceof DataUpdateError && /Refusing data bundle/.test(err.message),
    );
  } finally {
    if (prevEnv === undefined) delete process.env.EBB_RELEASES_URL;
    else process.env.EBB_RELEASES_URL = prevEnv;
    server.close();
  }
});

test("release-log-2: rejects update when release-log is tampered and leaves cache untouched", async () => {
  const { appendReleaseLog, ReleaseLogError } = await import("../src/data-release-log.js");
  const bundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: "2099-09-01T00:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const serialized = serializeDataBundle(bundle);
  const version = bundle.manifest.version;

  const log1 = appendReleaseLog("", {
    version: "2026.10.16",
    contentDigest: `sha256:${"1".repeat(64)}`,
    bundleSha256: `sha256:${"2".repeat(64)}`,
    createdAt: "2026-10-16T00:00:00Z",
  });
  const validLog = appendReleaseLog(log1, {
    version: "2026.11.11",
    contentDigest: bundle.manifest.contentDigest,
    bundleSha256: `sha256:${"3".repeat(64)}`,
    createdAt: "2026-11-11T00:00:00Z",
  });

  const lines = validLog.trim().split("\n");
  assert.equal(lines.length, 2);

  // 1. Change one entry (modify contentDigest in entry 1)
  const entry0Parsed = JSON.parse(lines[0]!);
  entry0Parsed.contentDigest = `sha256:${"f".repeat(64)}`;
  const tamperedChangedLog = `${JSON.stringify(entry0Parsed)}\n${lines[1]}\n`;

  // 2. Remove one entry (remove entry 1, so entry 2's previous does not match genesis)
  const tamperedRemovedLog = `${lines[1]}\n`;

  // 3. Reorder two entries (swap entry 1 and entry 2)
  const tamperedReorderedLog = `${lines[1]}\n${lines[0]}\n`;

  const baseUrl = "https://example.com";
  const releasesListing = [
    {
      tag_name: `data-v${version}`,
      draft: false,
      assets: [
        { name: `ebb-data-${version}.json`, browser_download_url: `${baseUrl}/bundle.json` },
        { name: `ebb-data-${version}.json.sigstore.json`, browser_download_url: `${baseUrl}/sig.json` },
        { name: "release-log.jsonl", browser_download_url: `${baseUrl}/release-log.jsonl` },
      ],
    },
  ];

  for (const [scenario, tamperedLog] of [
    ["change one entry", tamperedChangedLog],
    ["remove one entry", tamperedRemovedLog],
    ["reorder two", tamperedReorderedLog],
  ] as const) {
    const cache = await mkdtemp(join(workspace, `tampered-cache-${scenario.replace(/\s+/g, "-")}-`));
    const routes: Record<string, () => Response> = {
      [`${baseUrl}/releases.json`]: () => new Response(JSON.stringify(releasesListing)),
      [`${baseUrl}/bundle.json`]: () => new Response(serialized),
      [`${baseUrl}/sig.json`]: () => new Response("{}"),
      [`${baseUrl}/release-log.jsonl`]: () => new Response(tamperedLog),
    };

    await assert.rejects(
      () =>
        update({
          releasesUrl: `${baseUrl}/releases.json`,
          cacheDirectory: cache,
          verifySignature,
          fetch: mockFetch(routes),
        }),
      (err: unknown) => err instanceof ReleaseLogError,
      `Expected ${scenario} to fail with ReleaseLogError`,
    );

    // Verify cache remains untouched
    const files = existsSync(join(cache, "data")) ? await readdir(join(cache, "data")) : [];
    assert.deepEqual(files, [], `Cache must remain untouched on ${scenario}`);
  }
});

test("writeAtomically: interrupted write leaves previous data intact and cleans up temp files (cache-3)", async () => {
  const cache = await mkdtemp(join(workspace, "atomic-test-"));
  const targetFile = join(cache, "target.json");
  await writeFile(targetFile, "original content\n");

  // Attempt atomic write where directory does not exist
  const nonExistentTarget = join(cache, "nonexistent", "deep", "file.json");
  await assert.rejects(
    () => writeAtomically(nonExistentTarget, "new content\n"),
    (err: unknown) => (err as NodeJS.ErrnoException).code === "ENOENT",
  );

  // Original target is untouched
  const current = await readFile(targetFile, "utf8");
  assert.equal(current, "original content\n");

  // No temporary files left behind
  const files = await readdir(cache);
  assert.equal(
    files.some((f) => f.includes(".tmp-")),
    false,
  );

  // Successful atomic write updates content
  await writeAtomically(targetFile, "updated content\n");
  assert.equal(await readFile(targetFile, "utf8"), "updated content\n");
});

const bundledReviewedThrough = resolveActiveDataSync({ cacheDirectory: "" }).info.reviewedThrough;

test("cache-4: two concurrent updates run and end with a valid cache", async () => {
  const cache = await mkdtemp(join(workspace, "concurrent-update-"));
  const bundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: `${addDays(bundledReviewedThrough, 1)}T00:00:00Z`,
    minimumEbbVersion: "0.2.0",
    ecosystem: "npm",
  });
  const serialized = serializeDataBundle(bundle);
  const version = bundle.manifest.version;
  const baseUrl = "https://example-concurrent.com";
  const releases = releasesFor(version, baseUrl);

  const fetchHandler = (url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    if (urlStr === `${baseUrl}/releases.json`) return new Response(JSON.stringify(releases));
    if (urlStr.includes("/bundle-") && urlStr.endsWith(".json")) return new Response(serialized);
    if (urlStr.endsWith(".sigstore.json")) return new Response("{}");
    throw new Error(`Unexpected url ${urlStr}`);
  };

  // Run two updates concurrently
  const [res1, res2] = await Promise.all([
    update({
      releasesUrl: `${baseUrl}/releases.json`,
      cacheDirectory: cache,
      verifySignature,
      fetch: fetchHandler as unknown as typeof fetch,
    }),
    update({
      releasesUrl: `${baseUrl}/releases.json`,
      cacheDirectory: cache,
      verifySignature,
      fetch: fetchHandler as unknown as typeof fetch,
    }),
  ]);

  assert.ok(res1.status === "updated" || res1.status === "up-to-date");
  assert.ok(res2.status === "updated" || res2.status === "up-to-date");

  // Verify cache is in a valid state
  const activeJson = JSON.parse(await readFile(join(cache, "data", "active.json"), "utf8")) as { version: string };
  assert.equal(activeJson.version, version);
  assert.equal(existsSync(join(cache, "data", ".lock")), false, "lock file must be released");
});

test("cache-4: treats a lock older than 10 minutes as stale and cleans it up", async () => {
  const cache = await mkdtemp(join(workspace, "stale-lock-"));
  const lockDir = join(cache, "data");
  await mkdir(lockDir, { recursive: true });
  const lockFile = join(lockDir, ".lock");

  // Create a stale lock file with timestamp 15 minutes ago
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  await writeFile(lockFile, JSON.stringify({ pid: 99999, acquiredAt: fifteenMinutesAgo.toISOString() }) + "\n");
  const { utimes } = await import("node:fs/promises");
  await utimes(lockFile, fifteenMinutesAgo, fifteenMinutesAgo);

  const bundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: `${addDays(bundledReviewedThrough, 1)}T00:00:00Z`,
    minimumEbbVersion: "0.2.0",
    ecosystem: "npm",
  });
  const serialized = serializeDataBundle(bundle);
  const version = bundle.manifest.version;
  const baseUrl = "https://example-stale-lock.com";
  const releases = releasesFor(version, baseUrl);

  const fetchHandler = (url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    if (urlStr === `${baseUrl}/releases.json`) return new Response(JSON.stringify(releases));
    if (urlStr.includes("/bundle-") && urlStr.endsWith(".json")) return new Response(serialized);
    if (urlStr.endsWith(".sigstore.json")) return new Response("{}");
    throw new Error(`Unexpected url ${urlStr}`);
  };

  // Update should break stale lock and succeed
  const res = await update({
    releasesUrl: `${baseUrl}/releases.json`,
    cacheDirectory: cache,
    verifySignature,
    fetch: fetchHandler as unknown as typeof fetch,
  });
  assert.equal(res.status, "updated");
  assert.equal(existsSync(lockFile), false, "lock file must be removed upon completion");
});

test("cache-7: handles read-only cache directory with error code cache-read-only while reads continue to work", async () => {
  const cache = await mkdtemp(join(workspace, "readonly-cache-"));
  const bundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: `${addDays(bundledReviewedThrough, 1)}T00:00:00Z`,
    minimumEbbVersion: "0.2.0",
    ecosystem: "npm",
  });
  const version = bundle.manifest.version;
  const versionDir = join(cache, "data", version);
  await mkdir(versionDir, { recursive: true });
  await writeFile(join(cache, "data", "active.json"), JSON.stringify({ version }) + "\n");
  await writeFile(join(versionDir, "bundle.json"), JSON.stringify(bundle));
  await writeFile(join(versionDir, "bundle.json.sigstore.json"), "{}");

  // Make data directory read-only (chmod 0o555)
  const { chmod } = await import("node:fs/promises");
  await chmod(join(cache, "data"), 0o555);

  try {
    // 1. Reading cached data still works
    const active = resolveActiveDataSync({
      cacheDirectory: cache,
      verifySignature,
    });
    assert.equal(active.info.source, "cache");
    assert.equal(active.info.version, version);

    // 2. Updating throws DataUpdateError with code "cache-read-only"
    const newBundle = await buildDataBundle({
      root: fixtureRepo,
      createdAt: `${addDays(bundledReviewedThrough, 2)}T00:00:00Z`,
      minimumEbbVersion: "0.2.0",
      ecosystem: "npm",
    });
    const serialized = serializeDataBundle(newBundle);
    const baseUrl = "https://example-ro.com";
    const releases = releasesFor(newBundle.manifest.version, baseUrl);

    const fetchHandler = (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr === `${baseUrl}/releases.json`) return new Response(JSON.stringify(releases));
      if (urlStr.includes("/bundle-") && urlStr.endsWith(".json")) return new Response(serialized);
      if (urlStr.endsWith(".sigstore.json")) return new Response("{}");
      throw new Error(`Unexpected url ${urlStr}`);
    };

    await assert.rejects(
      () =>
        update({
          releasesUrl: `${baseUrl}/releases.json`,
          cacheDirectory: cache,
          verifySignature,
          fetch: fetchHandler as unknown as typeof fetch,
        }),
      (err: unknown) => {
        assert(err instanceof DataUpdateError);
        assert.equal(err.code, "cache-read-only");
        return true;
      },
    );
  } finally {
    await chmod(join(cache, "data"), 0o755);
  }
});

test("cache-8: uses conditional requests with ETag, 304 avoids bundle download", async () => {
  const cache = await mkdtemp(join(workspace, "etag-cache-"));
  const bundle = await buildDataBundle({
    root: fixtureRepo,
    createdAt: `${addDays(bundledReviewedThrough, 1)}T00:00:00Z`,
    minimumEbbVersion: "0.2.0",
    ecosystem: "npm",
  });
  const serialized = serializeDataBundle(bundle);
  const version = bundle.manifest.version;
  const baseUrl = "https://example-etag.com";
  const releases = releasesFor(version, baseUrl);

  let bundleDownloadCount = 0;
  let receivedIfNoneMatch: string | null = null;

  const fetchHandler = (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const reqHeaders = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));

    if (urlStr === `${baseUrl}/releases.json`) {
      receivedIfNoneMatch = reqHeaders.get("if-none-match");
      if (receivedIfNoneMatch === '"etag-v1"') {
        return new Response(null, { status: 304, headers: { ETag: '"etag-v1"' } });
      }
      return new Response(JSON.stringify(releases), { headers: { ETag: '"etag-v1"' } });
    }
    if (urlStr.endsWith(".sigstore.json")) return new Response("{}");
    if (urlStr.includes("/bundle-") && urlStr.endsWith(".json")) {
      bundleDownloadCount++;
      return new Response(serialized);
    }
    throw new Error(`Unexpected url ${urlStr}`);
  };

  // First update downloads and records ETag
  const res1 = await update({
    releasesUrl: `${baseUrl}/releases.json`,
    cacheDirectory: cache,
    verifySignature,
    fetch: fetchHandler as unknown as typeof fetch,
  });
  assert.equal(res1.status, "updated");
  assert.equal(bundleDownloadCount, 1);
  assert.equal(receivedIfNoneMatch, null);
  assert.equal(existsSync(join(cache, "data", RELEASES_ETAG_FILE)), true);
  assert.equal(await readFile(join(cache, "data", RELEASES_ETAG_FILE), "utf8"), '"etag-v1"\n');

  // Second update sends If-None-Match: "etag-v1", gets 304, does NOT download bundle
  const res2 = await update({
    releasesUrl: `${baseUrl}/releases.json`,
    cacheDirectory: cache,
    verifySignature,
    fetch: fetchHandler as unknown as typeof fetch,
  });
  assert.equal(res2.status, "up-to-date");
  assert.equal(bundleDownloadCount, 1, "must not download bundle on 304 not modified");
  assert.equal(receivedIfNoneMatch, '"etag-v1"');
});
