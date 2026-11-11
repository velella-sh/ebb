import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
    provenance: { observedAt: "2099-01-01", reviewedAt: "2099-01-01", reviewer: "test" },
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
