/**
 * Artifact and data bundle cryptographic verification for Ebb.
 * Operates with zero runtime dependencies using standard node:crypto.
 */

export {
  DataSignatureError,
  verifyArtifactSignature,
  getTrustedRoot,
  refreshTrustedRoot,
  resetTrustedRoot,
  type SignerPolicy,
  type VerifiedSigner,
  type TrustedRoot,
  type TrustedRootCertificateAuthority,
} from "./data-signature.js";

export {
  verifyDataBundle,
  type VerifiedDataBundle,
  type DataSourceOptions,
  type DataSourceInfo,
} from "./data-source.js";

import { type VerifiedDataBundle, type DataSourceOptions, verifyDataBundle } from "./data-source.js";

/**
 * Verifies a data bundle and its Sigstore keyless signature offline.
 *
 * Checks:
 * 1. Cryptographic signature and transparency log entries using Sigstore trusted root
 * 2. Pinned signer identity (releasing workflow and OIDC issuer)
 * 3. File SHA-256 digests and bundle contentDigest
 * 4. Rejection of tampered, unexpected, or malformed files
 * 5. Minimum Ebb version requirement
 * 6. Supported bundle schema version (v1 and v2)
 *
 * Supports plain JSON strings, Buffer/Uint8Array, and gzip-compressed bundles.
 *
 * @param bundle - Raw bundle bytes, JSON string, or object containing bundle and signature
 * @param signature - Sigstore bundle JSON string or bytes (optional if bundle contains signature)
 * @param options - Verification options including custom signer policy or trusted root
 * @returns Verified data bundle and signer details
 * @throws {DataBundleError} If signature, digest, schema, or content integrity fails
 */
export function verify(
  bundle: Uint8Array | string | { bundle: Uint8Array | string; signature: string | Uint8Array },
  signature?: string | Uint8Array,
  options?: DataSourceOptions,
): VerifiedDataBundle {
  let bundleBytes: Uint8Array;
  let signatureJson: string;

  if (
    typeof bundle === "object" &&
    bundle !== null &&
    !(bundle instanceof Uint8Array) &&
    "bundle" in bundle &&
    "signature" in bundle
  ) {
    bundleBytes = typeof bundle.bundle === "string" ? Buffer.from(bundle.bundle, "utf8") : bundle.bundle;
    signatureJson =
      typeof bundle.signature === "string" ? bundle.signature : Buffer.from(bundle.signature).toString("utf8");
  } else {
    if (!signature) {
      throw new Error("Missing required signature for bundle verification.");
    }
    bundleBytes = typeof bundle === "string" ? Buffer.from(bundle, "utf8") : (bundle as Uint8Array);
    signatureJson = typeof signature === "string" ? signature : Buffer.from(signature).toString("utf8");
  }

  return verifyDataBundle(bundleBytes, signatureJson, options);
}
