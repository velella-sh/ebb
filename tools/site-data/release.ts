import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { RegistryV2Rule } from "../../src/registry.js";
import { type VerifiedDataBundle, verify, verifyArtifactSignature } from "../../src/verify.js";

const historical = {
  version: "2026.11.11",
  sha256: "09f3f558e6708b6f7ec8fd4df0494601d4c1c99eb50526f7db20591a3852f3a4",
  ebbVersion: "0.2.0",
};

export interface SiteReleaseInput {
  bundlePath: string;
  signaturePath: string;
  version: string;
  sha256: string;
  historicalVerifier?: string | undefined;
}

async function verifyHistorical(
  bytes: Uint8Array,
  signature: string,
  input: SiteReleaseInput,
  packageDir: string,
): Promise<VerifiedDataBundle> {
  if (input.version !== historical.version || input.sha256 !== historical.sha256) {
    throw new Error("The historical verifier is only allowed for the pinned 2026.11.11 site data release.");
  }
  // Preserve today's signer policy. Only the historical bundle/registry format is read by the older verifier.
  verifyArtifactSignature(bytes, signature);
  const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
  if (manifest.name !== "@velella/ebb" || manifest.version !== historical.ebbVersion) {
    throw new Error(`Expected the published @velella/ebb@${historical.ebbVersion} historical verifier.`);
  }
  const { verifyDataBundle } = (await import(pathToFileURL(join(packageDir, "dist/src/verify.js")).href)) as {
    verifyDataBundle(bytes: Uint8Array, signature: string): VerifiedDataBundle;
  };
  return verifyDataBundle(bytes, signature);
}

export async function readSiteRelease(input: SiteReleaseInput): Promise<readonly RegistryV2Rule[]> {
  const [bytes, signature] = await Promise.all([readFile(input.bundlePath), readFile(input.signaturePath, "utf8")]);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (!/^[a-f0-9]{64}$/u.test(input.sha256) || input.sha256 !== digest) {
    throw new Error(`Site data release SHA-256 mismatch: expected ${input.sha256}, got ${digest}.`);
  }
  const { bundle } = input.historicalVerifier
    ? await verifyHistorical(bytes, signature, input, input.historicalVerifier)
    : verify(bytes, signature);
  if (bundle.manifest.version !== input.version || bundle.manifest.ecosystem) {
    throw new Error(`Expected complete Ebb data release ${input.version}, got ${bundle.manifest.version}.`);
  }
  return bundle.manifest.files
    .filter((file) => file.kind === "registry")
    .flatMap((file) => bundle.files[file.path]?.rules as RegistryV2Rule[]);
}
