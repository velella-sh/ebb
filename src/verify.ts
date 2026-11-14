/**
 * Artifact and data bundle cryptographic verification for Ebb.
 * Operates with zero runtime dependencies using standard node:crypto.
 */

export {
  DataSignatureError,
  verifyArtifactSignature,
  type SignerPolicy,
  type VerifiedSigner,
} from "./data-signature.js";

export { verifyDataBundle } from "./data-source.js";
