import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { buildDataBundle, canonicalJson, serializeDataBundle } from "../src/data-bundle.js";
import { DataSignatureError } from "../src/data-signature.js";
import { configureActiveData, resolveActiveData } from "../src/data-source.js";
import { DATA_STATUS_SCHEMA_VERSION, dataInfoFrom, dataStatusFrom, getDataStatus } from "../src/data-status.js";
import {
  compareBundleVersions,
  DATA_UPDATE_SCHEMA_VERSION,
  DataUpdateError,
  latestDataRelease,
  rollback,
  update,
  updateData,
} from "../src/data-update.js";
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
