import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { configureActiveData, DataPinError, getActiveData } from "../src/data-source.js";

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
