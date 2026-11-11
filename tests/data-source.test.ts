import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { buildDataBundle, DataBundleError, serializeDataBundle } from "../src/data-bundle.js";
import { configureActiveData, DataPinError, getActiveData, verifyDataBundle } from "../src/data-source.js";

const roots: string[] = [];

after(async () => {
  configureActiveData({});
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

test("getActiveData rejects for a missing pin instead of throwing synchronously", async () => {
  const cache = await mkdtemp(join(tmpdir(), "ebb-data-source-"));
  roots.push(cache);
  configureActiveData({ pinnedVersion: "2099.01.01", cacheDirectory: cache });

  let syncThrow = false;
  let pending: ReturnType<typeof getActiveData> | undefined;
  try {
    pending = getActiveData();
  } catch {
    syncThrow = true;
  }
  assert.equal(syncThrow, false);
  assert.ok(pending);
  await assert.rejects(pending, (error: unknown) => error instanceof DataPinError && error.missing === true);
});

test("verifyDataBundle enforces minimumEbbVersion using strict SemVer precedence", async () => {
  const bundle = await buildDataBundle({
    root: resolve("."),
    createdAt: "2026-10-16T09:30:00Z",
    minimumEbbVersion: "0.2.0",
  });
  const bytes = Buffer.from(serializeDataBundle(bundle), "utf8");
  const verifySignature = () => ({ identity: "ci@example.com", issuer: "https://token.actions.githubusercontent.com" });

  for (const okVersion of ["0.2.0", "0.2.0+build.1", "0.2.1", "1.0.0"]) {
    const verified = verifyDataBundle(bytes, "{}", { ebbVersion: okVersion, verifySignature });
    assert.equal(verified.bundle.manifest.minimumEbbVersion, "0.2.0");
  }
  for (const oldVersion of ["0.1.9", "0.2.0-rc.1"]) {
    assert.throws(
      () => verifyDataBundle(bytes, "{}", { ebbVersion: oldVersion, verifySignature }),
      (error: unknown) => error instanceof DataBundleError && error.message === "The bundle needs Ebb 0.2.0 or newer.",
    );
  }
});
