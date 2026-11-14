import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import {
  buildDataBundle,
  checkRollbackGuard,
  compressBundle,
  DATA_BUNDLE_V1_SCHEMA_VERSION,
  DATA_BUNDLE_V2_SCHEMA_VERSION,
  dataBundleIntegrityProblems,
  dataBundleShapeProblems,
  decompressBundle,
  serializeDataBundle,
} from "../src/data-bundle.js";
import { verifyDataBundle } from "../src/data-source.js";

const packageRoot = resolve(".");

async function v2Validator() {
  const schema = JSON.parse(await readFile(resolve("schemas/bundle.v2.schema.json"), "utf8")) as object;
  return new Ajv2020({ allErrors: true }).compile(schema);
}

test("bundle v2 schema validates a complete v2 bundle with sequence and digest list", async () => {
  const validate = await v2Validator();
  const bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    format: "v2",
    sequence: 42,
    minimumEbbVersion: "0.2.0",
  });

  assert.equal(bundle.manifest.schemaVersion, DATA_BUNDLE_V2_SCHEMA_VERSION);
  assert.equal(bundle.manifest.sequence, 42);
  assert.ok(Array.isArray(bundle.manifest.digestList));
  assert.ok(bundle.manifest.digestList.length > 0);
  assert.ok(bundle.manifest.digests);

  const parsed = JSON.parse(serializeDataBundle(bundle));
  const isValid = validate(parsed);
  assert.equal(isValid, true, JSON.stringify(validate.errors));
});

test("bundle v2 schema rejects invalid sequence numbers or malformed format", async () => {
  const validate = await v2Validator();
  const bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    format: "v2",
    sequence: 1,
    minimumEbbVersion: "0.2.0",
  });

  const parsed = JSON.parse(serializeDataBundle(bundle));

  // Sequence must be >= 1
  parsed.manifest.sequence = 0;
  assert.equal(validate(parsed), false);

  parsed.manifest.sequence = -5;
  assert.equal(validate(parsed), false);

  // Missing sequence
  delete parsed.manifest.sequence;
  assert.equal(validate(parsed), false);

  // Wrong schemaVersion
  parsed.manifest.sequence = 1;
  parsed.manifest.schemaVersion = "ebb.data-bundle.v1";
  assert.equal(validate(parsed), false);
});

test("per-ecosystem bundles build and verify cleanly", async () => {
  const npmBundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    format: "v2",
    sequence: 10,
    ecosystem: "npm",
    minimumEbbVersion: "0.2.0",
  });

  assert.equal(npmBundle.manifest.ecosystem, "npm");
  assert.equal(npmBundle.manifest.files.length, 1);
  assert.equal(npmBundle.manifest.files[0]!.path, "registry/npm.json");
  assert.ok(npmBundle.files["registry/npm.json"]);
  assert.equal(npmBundle.files["registry/python.json"], undefined);

  assert.deepEqual(dataBundleShapeProblems(npmBundle), []);
  assert.deepEqual(dataBundleIntegrityProblems(npmBundle), []);

  const bytes = Buffer.from(serializeDataBundle(npmBundle), "utf8");
  const verifySig = () => ({
    identity: "https://github.com/velella-sh/ebb/.github/workflows/data-release.yml@refs/heads/main",
    issuer: "https://token.actions.githubusercontent.com",
  });

  const verified = verifyDataBundle(bytes, "{}", { verifySignature: verifySig });
  assert.equal(verified.bundle.manifest.ecosystem, "npm");
  assert.equal(verified.bundle.manifest.files.length, 1);
});

test("gzip compression and transparent decompression", async () => {
  const bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    format: "v2",
    minimumEbbVersion: "0.2.0",
  });
  const serialized = serializeDataBundle(bundle);
  const compressed = compressBundle(serialized);

  assert.ok(compressed.length < Buffer.byteLength(serialized, "utf8"));
  assert.equal(compressed[0], 0x1f);
  assert.equal(compressed[1], 0x8b);

  const decompressed = decompressBundle(compressed);
  assert.equal(decompressed, serialized);

  // verifyDataBundle transparently handles compressed bytes
  const verifySig = () => ({
    identity: "https://github.com/velella-sh/ebb/.github/workflows/data-release.yml@refs/heads/main",
    issuer: "https://token.actions.githubusercontent.com",
  });

  const verified = verifyDataBundle(compressed, "{}", { verifySignature: verifySig });
  assert.equal(verified.bundle.manifest.version, bundle.manifest.version);
});

test("rollback guard refuses older sequence, older date, or older version", () => {
  // Sequence rollback check
  const curSeq = { version: "2026.10.16", createdAt: "2026-10-16T12:00:00Z", sequence: 10 };
  const oldSeq = { version: "2026.10.17", createdAt: "2026-10-17T12:00:00Z", sequence: 9 };
  const newSeq = { version: "2026.10.17", createdAt: "2026-10-17T12:00:00Z", sequence: 11 };

  const seqCheck = checkRollbackGuard(curSeq, oldSeq);
  assert.equal(seqCheck.isRollback, true);
  assert.match(seqCheck.reason!, /older than active sequence/);

  const seqCheckOk = checkRollbackGuard(curSeq, newSeq);
  assert.equal(seqCheckOk.isRollback, false);

  // Allowed downgrade bypasses check
  const allowCheck = checkRollbackGuard(curSeq, oldSeq, true);
  assert.equal(allowCheck.isRollback, false);

  // Date rollback check (when sequence is not present)
  const curDate = { version: "2026.10.16", createdAt: "2026-10-16T12:00:00Z" };
  const oldDate = { version: "2026.10.15", createdAt: "2026-10-15T12:00:00Z" };
  const dateCheck = checkRollbackGuard(curDate, oldDate);
  assert.equal(dateCheck.isRollback, true);
  assert.match(dateCheck.reason!, /older than active data created at/);

  // Version rollback check
  const curVer = { version: "2026.10.16.2" };
  const oldVer = { version: "2026.10.16" };
  const verCheck = checkRollbackGuard(curVer, oldVer);
  assert.equal(verCheck.isRollback, true);
  assert.match(verCheck.reason!, /older than active version/);
});

test("Ebb keeps reading and verifying v1 bundles alongside v2", async () => {
  const v1Bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    format: "v1",
    minimumEbbVersion: "0.2.0",
  });
  assert.equal(v1Bundle.manifest.schemaVersion, DATA_BUNDLE_V1_SCHEMA_VERSION);
  assert.equal(v1Bundle.manifest.sequence, undefined);

  const v2Bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-17T09:30:00Z",
    format: "v2",
    sequence: 2,
    minimumEbbVersion: "0.2.0",
  });
  assert.equal(v2Bundle.manifest.schemaVersion, DATA_BUNDLE_V2_SCHEMA_VERSION);
  assert.equal(v2Bundle.manifest.sequence, 2);

  // Shape validation accepts both
  assert.deepEqual(dataBundleShapeProblems(v1Bundle), []);
  assert.deepEqual(dataBundleShapeProblems(v2Bundle), []);

  const verifySig = () => ({
    identity: "https://github.com/velella-sh/ebb/.github/workflows/data-release.yml@refs/heads/main",
    issuer: "https://token.actions.githubusercontent.com",
  });

  const verifiedV1 = verifyDataBundle(Buffer.from(serializeDataBundle(v1Bundle), "utf8"), "{}", {
    verifySignature: verifySig,
  });
  const verifiedV2 = verifyDataBundle(Buffer.from(serializeDataBundle(v2Bundle), "utf8"), "{}", {
    verifySignature: verifySig,
  });

  assert.equal(verifiedV1.bundle.manifest.schemaVersion, "ebb.data-bundle.v1");
  assert.equal(verifiedV2.bundle.manifest.schemaVersion, "ebb.data-bundle.v2");
});

test("measure size change between v1, v2, gzipped, and per-ecosystem bundles", async () => {
  const v1 = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    format: "v1",
    minimumEbbVersion: "0.2.0",
  });
  const v2 = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    format: "v2",
    sequence: 1,
    minimumEbbVersion: "0.2.0",
  });
  const npmScoped = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    format: "v2",
    sequence: 1,
    ecosystem: "npm",
    minimumEbbVersion: "0.2.0",
  });

  const v1Bytes = Buffer.byteLength(serializeDataBundle(v1), "utf8");
  const v2Bytes = Buffer.byteLength(serializeDataBundle(v2), "utf8");
  const v2GzipBytes = compressBundle(serializeDataBundle(v2)).length;
  const npmScopedBytes = Buffer.byteLength(serializeDataBundle(npmScoped), "utf8");
  const npmScopedGzipBytes = compressBundle(serializeDataBundle(npmScoped)).length;

  assert.ok(v1Bytes > 0);
  assert.ok(v2Bytes > 0);
  // Gzip achieves massive reduction (> 70% compression)
  const reduction = 1 - v2GzipBytes / v2Bytes;
  assert.ok(reduction > 0.7, `Expected gzip reduction > 70%, got ${(reduction * 100).toFixed(1)}%`);

  // Per-ecosystem bundle is much smaller than full bundle
  assert.ok(npmScopedBytes < v2Bytes / 3, `Expected npm scoped bundle < 1/3 full bundle`);
  assert.ok(npmScopedGzipBytes < v2GzipBytes / 3);
});
