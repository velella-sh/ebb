import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

import { buildDataBundle, serializeDataBundle, DATA_SIGNER } from "../src/data-bundle.js";
import { runCli } from "../src/cli.js";
import {
  DataSignatureError,
  getTrustedRoot,
  refreshTrustedRoot,
  resetTrustedRoot,
  verify,
  verifyArtifactSignature,
  verifyDataBundle,
  type TrustedRoot,
} from "../src/verify.js";

const packageRoot = resolve(".");
const artifactPath = join(packageRoot, "tests/fixtures/sigstore/cosign_checksums.txt");
const sigPath = join(packageRoot, "tests/fixtures/sigstore/cosign_checksums.txt.sigstore.json");

const artifactBytes = await readFile(artifactPath);
const sigJson = await readFile(sigPath, "utf8");

const cosignPolicy = {
  issuer: "https://accounts.google.com",
  identityPattern: "^keyless@projectsigstore\\.iam\\.gserviceaccount\\.com$",
};

let tempDir = "";

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ebb-verify-test-"));
});

after(async () => {
  resetTrustedRoot();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("verify subpath exports verify, verifyArtifactSignature, verifyDataBundle, and trusted root helpers", () => {
  assert.equal(typeof verify, "function");
  assert.equal(typeof verifyArtifactSignature, "function");
  assert.equal(typeof verifyDataBundle, "function");
  assert.equal(typeof refreshTrustedRoot, "function");
  assert.equal(typeof getTrustedRoot, "function");
  assert.equal(typeof resetTrustedRoot, "function");
});

test("verify offline with shipped trusted root against a genuine keyless signature", () => {
  const signer = verifyArtifactSignature(artifactBytes, sigJson, cosignPolicy);
  assert.equal(signer.identity, "keyless@projectsigstore.iam.gserviceaccount.com");
  assert.equal(signer.issuer, "https://accounts.google.com");
});

test("pins expected signer identity and rejects signatures signed by another workflow", () => {
  // cosign cert does not match Ebb release workflow
  assert.throws(
    () => verifyArtifactSignature(artifactBytes, sigJson),
    (error: unknown) => error instanceof DataSignatureError && /does not match policy pattern/.test(error.message),
  );

  // wrong issuer
  assert.throws(
    () => verifyArtifactSignature(artifactBytes, sigJson, { ...cosignPolicy, issuer: DATA_SIGNER.issuer }),
    (error: unknown) => error instanceof DataSignatureError && /does not match policy issuer/.test(error.message),
  );

  // wrong identity
  assert.throws(
    () =>
      verifyArtifactSignature(artifactBytes, sigJson, {
        ...cosignPolicy,
        identityPattern: "^other-identity@example\\.com$",
      }),
    (error: unknown) => error instanceof DataSignatureError && /does not match policy pattern/.test(error.message),
  );
});

test("refreshTrustedRoot validates candidate root before accepting it", () => {
  // Invalid json
  assert.throws(
    () => refreshTrustedRoot("not json"),
    (err: unknown) => err instanceof DataSignatureError && /invalid JSON/.test(err.message),
  );

  // Missing CAs
  assert.throws(
    () => refreshTrustedRoot({} as TrustedRoot),
    (err: unknown) => err instanceof DataSignatureError && /missing or empty certificateAuthorities/.test(err.message),
  );

  // Empty CAs
  assert.throws(
    () => refreshTrustedRoot({ certificateAuthorities: [] }),
    (err: unknown) => err instanceof DataSignatureError && /missing or empty certificateAuthorities/.test(err.message),
  );

  // CA with no valid certs
  assert.throws(
    () =>
      refreshTrustedRoot({
        certificateAuthorities: [{ certChain: { certificates: [{ rawBytes: "invalid-base64-cert" }] } }],
      }),
    (err: unknown) => err instanceof DataSignatureError && /no valid X.509 certificate found/.test(err.message),
  );

  // Valid root refresh
  const current = getTrustedRoot();
  assert.ok(current.certificateAuthorities && current.certificateAuthorities.length > 0);
  const refreshed = refreshTrustedRoot(current);
  assert.deepEqual(refreshed, current);
  assert.equal(getTrustedRoot(), refreshed);

  // Reset restores default
  resetTrustedRoot();
  assert.ok(getTrustedRoot());
});

test("rejects bundles with wrong digest or tampered content", async () => {
  const bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    minimumEbbVersion: "0.2.0",
  });
  const serialized = serializeDataBundle(bundle);
  const rawBytes = Buffer.from(serialized, "utf8");

  // Tampered artifact with cosign signature
  const tamperedBytes = Buffer.concat([artifactBytes, Buffer.from("tampered")]);
  assert.throws(
    () => verifyArtifactSignature(tamperedBytes, sigJson, cosignPolicy),
    (err: unknown) => err instanceof DataSignatureError && /digest mismatch/.test(err.message),
  );

  // Single byte change fails closed
  const flippedByte = Buffer.from(artifactBytes);
  flippedByte[0] = flippedByte[0]! ^ 0xff;
  assert.throws(
    () => verifyArtifactSignature(flippedByte, sigJson, cosignPolicy),
    (err: unknown) => err instanceof DataSignatureError,
  );

  // Synthetic signature on bundle with mismatch digest
  const mockSig = {
    mediaType: "application/vnd.dev.sigstore.bundle+json;version=0.2",
    verificationMaterial: {
      certificate: { rawBytes: "test" },
      tlogEntries: [{}],
    },
    messageSignature: {
      messageDigest: { algorithm: "SHA2_256", digest: Buffer.from("wrong-digest").toString("base64") },
      signature: "test",
    },
  };
  assert.throws(
    () => verify(rawBytes, JSON.stringify(mockSig)),
    (err: unknown) => err instanceof Error,
  );
});

test("verify(bundle, signature) accepts multiple caller argument styles", async () => {
  const bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    minimumEbbVersion: "0.2.0",
  });
  const serialized = serializeDataBundle(bundle);
  const rawBytes = Buffer.from(serialized, "utf8");

  const mockVerifySig = () => ({
    identity: "https://github.com/velella-sh/ebb/.github/workflows/data-release.yml@refs/heads/main",
    issuer: "https://token.actions.githubusercontent.com",
  });

  // Style 1: verify(bytes, signatureJson, options)
  const res1 = verify(rawBytes, "{}", { verifySignature: mockVerifySig });
  assert.equal(res1.bundle.manifest.version, "2026.10.16");

  // Style 2: verify(jsonString, signatureJson, options)
  const res2 = verify(serialized, "{}", { verifySignature: mockVerifySig });
  assert.equal(res2.bundle.manifest.version, "2026.10.16");

  // Style 3: verify({ bundle, signature }, undefined, options)
  const res3 = verify({ bundle: rawBytes, signature: "{}" }, undefined, { verifySignature: mockVerifySig });
  assert.equal(res3.bundle.manifest.version, "2026.10.16");
});

test("measures verification time performance", () => {
  const start = performance.now();
  for (let i = 0; i < 5; i++) {
    verifyArtifactSignature(artifactBytes, sigJson, cosignPolicy);
  }
  const duration = performance.now() - start;
  const avg = duration / 5;
  assert.ok(avg < 50, `Verification should take < 50ms, took ${avg.toFixed(2)}ms`);
});

test("CLI: ebb verify <file> checks bundles and artifacts", async () => {
  const bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2026-10-16T09:30:00Z",
    minimumEbbVersion: "0.2.0",
  });
  const serialized = serializeDataBundle(bundle);
  const bundleFile = join(tempDir, "test-bundle.json");
  await writeFile(bundleFile, serialized);

  // Missing file argument
  let stderr = "";
  let stdout = "";
  const io = {
    stdout: {
      write: (str: string) => {
        stdout += str;
      },
    },
    stderr: {
      write: (str: string) => {
        stderr += str;
      },
    },
  };

  const codeMissing = await runCli(["verify"], io);
  assert.equal(codeMissing, 2);
  assert.match(stderr, /Missing file argument/);

  // Non-existent bundle file
  stderr = "";
  const codeNotFound = await runCli(["verify", join(tempDir, "does-not-exist.json")], io);
  assert.equal(codeNotFound, 2);
  assert.match(stderr, /Bundle file not found/);

  // Missing signature file
  stderr = "";
  const codeNoSig = await runCli(["verify", bundleFile], io);
  assert.equal(codeNoSig, 2);
  assert.match(stderr, /Signature file not found/);

  // Valid artifact check using cosign fixture
  stderr = "";
  stdout = "";
  const artifactCode = await runCli(["verify", artifactPath, "--signature", sigPath], io);
  // Refused because signer is cosign, not Ebb release workflow
  assert.equal(artifactCode, 2);
  assert.match(stderr, /Verification failed/);

  // Valid artifact with --json flag outputs structured json error
  stdout = "";
  stderr = "";
  const jsonCode = await runCli(["verify", artifactPath, "--signature", sigPath, "--json"], io);
  assert.equal(jsonCode, 2);
  const parsedJson = JSON.parse(stdout) as { ok: boolean; file: string; error: string };
  assert.equal(parsedJson.ok, false);
  assert.equal(parsedJson.file, artifactPath);
});
