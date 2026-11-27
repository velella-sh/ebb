import type { BridgePackageItem, ScannerBridgeInput } from "./types.js";

/**
 * Reads a Trivy JSON report (e.g. from `trivy image --format json --list-all-pkgs` or `trivy fs`).
 *
 * Extracts package items from `Results[].Packages[]` using `Identifier.PURL` and `Version`,
 * keeping the target and package ID.
 * Reads the OS family and version from `Metadata.OS` and includes it as an OS purl.
 * Emits a warning when the report was made without `--list-all-pkgs`.
 */
export function readTrivyReport(content: string | Record<string, unknown>): ScannerBridgeInput {
  let raw: Record<string, unknown>;
  if (typeof content === "string") {
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`Failed to parse Trivy report JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    raw = content;
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Trivy report must be a valid JSON object");
  }

  const target = String(raw.ArtifactName || "target");
  const warnings: string[] = [];
  const items: BridgePackageItem[] = [];

  // Read OS from Metadata.OS if available
  const metadata =
    typeof raw.Metadata === "object" && raw.Metadata !== null ? (raw.Metadata as Record<string, unknown>) : undefined;
  if (metadata && typeof metadata.OS === "object" && metadata.OS !== null) {
    const os = metadata.OS as Record<string, unknown>;
    const family = typeof os.Family === "string" ? os.Family.trim() : "";
    const name = typeof os.Name === "string" ? os.Name.trim() : "";
    if (family && name) {
      const osFamilyKey = family.toLowerCase();
      items.push({
        id: `os:${osFamilyKey}`,
        name: family,
        version: name,
        purl: `pkg:generic/${osFamilyKey}@${name}`,
        target,
      });
    }
  }

  let hasPackages = false;
  if (Array.isArray(raw.Results)) {
    for (const result of raw.Results) {
      if (!result || typeof result !== "object") continue;
      const resObj = result as Record<string, unknown>;
      const resTarget = String(resObj.Target || target);

      if (Array.isArray(resObj.Packages)) {
        hasPackages = true;
        for (const pkg of resObj.Packages) {
          if (!pkg || typeof pkg !== "object") continue;
          const pkgObj = pkg as Record<string, unknown>;
          const name = String(pkgObj.Name || "");
          const version = String(pkgObj.Version || "");
          const id = String(pkgObj.ID || (name && version ? `${name}@${version}` : name || "unknown"));

          let purl: string | undefined = undefined;
          if (pkgObj.Identifier && typeof pkgObj.Identifier === "object" && pkgObj.Identifier !== null) {
            const ident = pkgObj.Identifier as Record<string, unknown>;
            if (typeof ident.PURL === "string" && ident.PURL) {
              purl = ident.PURL;
            }
          }
          if (!purl && typeof pkgObj.PURL === "string" && pkgObj.PURL) {
            purl = pkgObj.PURL;
          }

          items.push({
            id,
            name,
            version,
            purl,
            target: resTarget,
          });
        }
      }
    }
  }

  if (!hasPackages) {
    warnings.push(
      "Trivy report was generated without --list-all-pkgs; only packages with detected vulnerabilities were reported (or package inventory was omitted).",
    );
  }

  // Version identification
  let scannerVersion = "0.60.0";
  if (typeof raw.ScannerVersion === "string") {
    scannerVersion = raw.ScannerVersion;
  }

  return {
    scanner: "trivy",
    scannerVersion,
    target,
    items,
    warnings,
    rawReport: raw,
  };
}
