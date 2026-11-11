import { createHash, verify, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";

import { DATA_SIGNER } from "./data-bundle.js";
import { findPackageFileSync } from "./package-files.js";

export class DataSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataSignatureError";
  }
}

export interface SignerPolicy {
  /** OIDC issuer the signing certificate must carry. */
  issuer: string;
  /** Regular expression the certificate's identity (the signing workflow's ref) must match. */
  identityPattern: string;
}

export interface VerifiedSigner {
  identity: string;
  issuer: string;
}

export interface TrustedRootCertificateAuthority {
  certChain?: {
    certificates?: Array<{ rawBytes: string }>;
  };
  validFor?: { start?: string; end?: string };
}

export interface TrustedRoot {
  mediaType?: string;
  tlogs?: unknown[];
  certificateAuthorities?: TrustedRootCertificateAuthority[];
  ctlogs?: unknown[];
  timestampAuthorities?: unknown[];
}

export const TrustedRoot = {
  fromJSON(json: unknown): TrustedRoot {
    return json as TrustedRoot;
  },
};

let bundledRoot: TrustedRoot | undefined;

/** The Sigstore public-good trusted root shipped with the package (`data/sigstore-trusted-root.json`). */
function bundledTrustedRoot(): TrustedRoot {
  bundledRoot ??= JSON.parse(
    readFileSync(findPackageFileSync("data/sigstore-trusted-root.json", import.meta.url), "utf8"),
  ) as TrustedRoot;
  return bundledRoot;
}

function extractIdentity(san: string | undefined): string {
  if (!san) return "";
  const commaIdx = san.indexOf(",");
  const first = commaIdx === -1 ? san : san.slice(0, commaIdx);
  const colonIdx = first.indexOf(":");
  return colonIdx === -1 ? first.trim() : first.slice(colonIdx + 1).trim();
}

function extractOidcIssuer(certDer: Buffer): string {
  // Sigstore Issuer OID: 1.3.6.1.4.1.57264.1.1
  const oid = Buffer.from([0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x83, 0xbf, 0x30, 0x01, 0x01]);
  const idx = certDer.indexOf(oid);
  if (idx === -1) return "";
  let pos = idx + oid.length;
  // If boolean critical flag is present (01 01 xx)
  if (certDer[pos] === 0x01 && certDer[pos + 1] === 0x01) {
    pos += 3;
  }
  // Octet string tag is 0x04
  if (certDer[pos] === 0x04) {
    let len = certDer[pos + 1] ?? 0;
    pos += 2;
    if (len & 0x80) {
      const numBytes = len & 0x7f;
      len = 0;
      for (let i = 0; i < numBytes; i++) {
        len = (len << 8) | (certDer[pos++] ?? 0);
      }
    }
    // If the octet string contains an ASN.1 UTF8String (0x0c) or PrintableString (0x13) or IA5String (0x16)
    if (certDer[pos] === 0x0c || certDer[pos] === 0x13 || certDer[pos] === 0x16) {
      const subLen = certDer[pos + 1] ?? 0;
      pos += 2;
      return certDer.subarray(pos, pos + subLen).toString("utf8");
    }
    return certDer.subarray(pos, pos + len).toString("utf8");
  }
  return "";
}

/**
 * Verifies, offline, that `artifact` was signed by the signer the policy names. Checks the signature itself, the
 * certificate chain and validity against the trusted root, the transparency-log inclusion, and the certificate
 * identity and issuer. Anything else throws {@link DataSignatureError}; nothing is ever returned for a bundle that
 * did not verify.
 * @deprecated Import from `@velella/ebb` instead; subpath imports will be removed in 1.0.
 */
export function verifyArtifactSignature(
  artifact: Uint8Array,
  signatureJson: string,
  policy: SignerPolicy = DATA_SIGNER,
  trustedRoot: TrustedRoot = bundledTrustedRoot(),
): VerifiedSigner {
  let parsed: {
    mediaType?: unknown;
    verificationMaterial?: {
      certificate?: { rawBytes?: string };
      tlogEntries?: unknown[];
    };
    messageSignature?: {
      messageDigest?: { algorithm?: string; digest?: string };
      signature?: string;
    };
  };
  try {
    parsed = JSON.parse(signatureJson);
  } catch {
    throw new DataSignatureError("The signature file is not valid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !parsed.mediaType ||
    !parsed.verificationMaterial ||
    !parsed.verificationMaterial.certificate ||
    !parsed.verificationMaterial.certificate.rawBytes ||
    !Array.isArray(parsed.verificationMaterial.tlogEntries) ||
    parsed.verificationMaterial.tlogEntries.length === 0 ||
    !parsed.messageSignature ||
    !parsed.messageSignature.messageDigest ||
    !parsed.messageSignature.messageDigest.digest ||
    !parsed.messageSignature.signature
  ) {
    throw new DataSignatureError("The signature file is not a Sigstore bundle: missing required bundle structure");
  }

  const certDer = Buffer.from(parsed.verificationMaterial.certificate.rawBytes, "base64");
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(certDer);
  } catch (error) {
    throw new DataSignatureError(`The signature did not verify: invalid certificate: ${(error as Error).message}`);
  }

  // Verify digest
  const expectedDigest = Buffer.from(parsed.messageSignature.messageDigest.digest, "base64");
  const algo =
    parsed.messageSignature.messageDigest.algorithm?.toLowerCase().includes("sha2_256") ||
    parsed.messageSignature.messageDigest.algorithm?.toLowerCase().includes("sha256")
      ? "sha256"
      : "sha256";
  const actualDigest = createHash(algo).update(artifact).digest();
  if (!actualDigest.equals(expectedDigest)) {
    throw new DataSignatureError("The signature did not verify: digest mismatch");
  }

  // Verify signature
  const signatureBuffer = Buffer.from(parsed.messageSignature.signature, "base64");
  try {
    const verified = verify(algo, artifact, cert.publicKey, signatureBuffer);
    if (!verified) {
      throw new DataSignatureError("The signature did not verify: cryptographic signature check failed");
    }
  } catch (error) {
    throw new DataSignatureError(`The signature did not verify: ${(error as Error).message}`);
  }

  // Verify certificate chain against trusted root CAs
  let caVerified = false;
  if (trustedRoot && Array.isArray(trustedRoot.certificateAuthorities)) {
    for (const ca of trustedRoot.certificateAuthorities) {
      const certs = ca.certChain?.certificates ?? [];
      for (const caCertItem of certs) {
        try {
          const caCert = new X509Certificate(Buffer.from(caCertItem.rawBytes, "base64"));
          if (cert.verify(caCert.publicKey)) {
            caVerified = true;
            break;
          }
        } catch {
          // continue checking
        }
      }
      if (caVerified) break;
    }
  }

  if (!caVerified) {
    throw new DataSignatureError("The signature did not verify: certificate was not signed by a trusted root CA");
  }

  // Verify identity and issuer
  const identity = extractIdentity(cert.subjectAltName);
  const issuer = extractOidcIssuer(certDer);

  const pattern = new RegExp(policy.identityPattern);
  if (!pattern.test(identity)) {
    throw new DataSignatureError(
      `The signature did not verify: identity "${identity}" does not match policy pattern "${policy.identityPattern}"`,
    );
  }

  if (issuer !== policy.issuer) {
    throw new DataSignatureError(
      `The signature did not verify: issuer "${issuer}" does not match policy issuer "${policy.issuer}"`,
    );
  }

  return { identity, issuer };
}
