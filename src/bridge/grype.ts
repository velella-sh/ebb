import type { BridgePackageItem, ScannerBridgeInput } from "./types.js";

/**
 * Reads a Syft JSON document and returns normalized package items.
 */
export function readSyftReport(content: string | Record<string, unknown>): ScannerBridgeInput {
  let raw: Record<string, unknown>;
  if (typeof content === "string") {
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`Failed to parse Syft JSON document: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    raw = content;
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Syft document must be a valid JSON object");
  }

  let target = "target";
  if (raw.source && typeof raw.source === "object") {
    const srcObj = raw.source as Record<string, unknown>;
    if (typeof srcObj.target === "string") {
      target = srcObj.target;
    } else if (typeof srcObj.target === "object" && srcObj.target !== null) {
      target = JSON.stringify(srcObj.target);
    }
  }

  const items: BridgePackageItem[] = [];

  // Distro handling
  if (raw.distro && typeof raw.distro === "object") {
    const distro = raw.distro as Record<string, unknown>;
    const name = typeof distro.name === "string" ? distro.name.trim() : "";
    const version = typeof distro.version === "string" ? distro.version.trim() : "";
    if (name && version) {
      const distroKey = name.toLowerCase();
      items.push({
        id: `os:${distroKey}`,
        name,
        version,
        purl: `pkg:generic/${distroKey}@${version}`,
        target,
      });
    }
  }

  if (Array.isArray(raw.artifacts)) {
    for (const art of raw.artifacts) {
      if (!art || typeof art !== "object") continue;
      const artObj = art as Record<string, unknown>;
      const id = String(artObj.id || artObj.name || "unknown");
      const name = String(artObj.name || "");
      const version = String(artObj.version || "");
      const purl = typeof artObj.purl === "string" && artObj.purl ? artObj.purl : undefined;

      items.push({
        id,
        name,
        version,
        purl,
        target,
      });
    }
  }

  let scannerVersion = "1.19.0";
  if (raw.descriptor && typeof raw.descriptor === "object") {
    const desc = raw.descriptor as Record<string, unknown>;
    if (typeof desc.version === "string") {
      scannerVersion = desc.version;
    }
  }

  return {
    scanner: "grype",
    scannerVersion,
    target,
    items,
    warnings: [],
    rawReport: raw,
  };
}

/**
 * Reads a Grype JSON report (e.g. `grype <target> -o json`).
 *
 * Reads `matches[].artifact` and `source`, and warns that Grype lists only vulnerable artifacts.
 * If a Syft document with `artifacts[]` is passed, reuses the Syft reader.
 * Reads distro from the `distro` field and includes it as an OS purl.
 */
export function readGrypeReport(content: string | Record<string, unknown>): ScannerBridgeInput {
  let raw: Record<string, unknown>;
  if (typeof content === "string") {
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`Failed to parse Grype report JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    raw = content;
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Grype report must be a valid JSON object");
  }

  // If this is a Syft SBOM document containing artifacts, reuse Syft reader
  if (Array.isArray(raw.artifacts) && !raw.matches) {
    return readSyftReport(raw);
  }

  let target = "target";
  if (raw.source && typeof raw.source === "object") {
    const srcObj = raw.source as Record<string, unknown>;
    if (typeof srcObj.target === "string") {
      target = srcObj.target;
    } else if (typeof srcObj.target === "object" && srcObj.target !== null) {
      target = JSON.stringify(srcObj.target);
    }
  }

  const warnings: string[] = [
    "Grype reports list only vulnerable artifacts by default. For a complete package inventory lifecycle evaluation, supply a Syft SBOM document.",
  ];

  const items: BridgePackageItem[] = [];
  const seenKeys = new Set<string>();

  // Distro handling
  if (raw.distro && typeof raw.distro === "object") {
    const distro = raw.distro as Record<string, unknown>;
    const name = typeof distro.name === "string" ? distro.name.trim() : "";
    const version = typeof distro.version === "string" ? distro.version.trim() : "";
    if (name && version) {
      const distroKey = name.toLowerCase();
      items.push({
        id: `os:${distroKey}`,
        name,
        version,
        purl: `pkg:generic/${distroKey}@${version}`,
        target,
      });
      seenKeys.add(`os:${distroKey}`);
    }
  }

  if (Array.isArray(raw.matches)) {
    for (const match of raw.matches) {
      if (!match || typeof match !== "object") continue;
      const matchObj = match as Record<string, unknown>;
      if (!matchObj.artifact || typeof matchObj.artifact !== "object") continue;
      const art = matchObj.artifact as Record<string, unknown>;

      const id = String(art.id || art.name || "unknown");
      const name = String(art.name || "");
      const version = String(art.version || "");
      const purl = typeof art.purl === "string" && art.purl ? art.purl : undefined;

      const dedupeKey = `${id}::${purl ?? name}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      items.push({
        id,
        name,
        version,
        purl,
        target,
      });
    }
  }

  let scannerVersion = "0.87.0";
  if (raw.descriptor && typeof raw.descriptor === "object") {
    const desc = raw.descriptor as Record<string, unknown>;
    if (typeof desc.version === "string") {
      scannerVersion = desc.version;
    }
  }

  return {
    scanner: "grype",
    scannerVersion,
    target,
    items,
    warnings,
    rawReport: raw,
  };
}
