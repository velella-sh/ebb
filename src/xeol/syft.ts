/**
 * Syft JSON document parser for xeol migration compatibility.
 */

export interface SyftLocation {
  path?: string;
  layerID?: string;
  [key: string]: unknown;
}

export interface SyftUpstream {
  name: string;
  version?: string;
}

export interface SyftArtifact {
  id?: string;
  name?: string;
  version?: string;
  type?: string;
  purl?: string;
  locations?: SyftLocation[];
  licenses?: unknown[];
  language?: string;
  cpes?: string[];
  upstreams?: SyftUpstream[];
  metadataType?: string;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface SyftSource {
  type?: string;
  target?: unknown;
  [key: string]: unknown;
}

export interface SyftDistro {
  name?: string;
  version?: string;
  idLike?: string[];
  [key: string]: unknown;
}

export interface SyftDescriptor {
  name?: string;
  version?: string;
  [key: string]: unknown;
}

export interface SyftDocument {
  artifacts?: SyftArtifact[];
  source?: SyftSource;
  distro?: SyftDistro;
  descriptor?: SyftDescriptor;
  schema?: {
    version?: string;
    url?: string;
  };
  [key: string]: unknown;
}

export interface SyftCheckItem {
  id: string;
  purl: string;
  version: string;
  artifact: SyftArtifact;
}

export interface SyftReadResult {
  items: SyftCheckItem[];
  artifactsWithoutPurl: number;
  totalArtifacts: number;
  document: SyftDocument;
}

/**
 * Type guard checking if an input object has the structure of a Syft JSON document.
 */
export function isSyftDocument(doc: unknown): doc is SyftDocument {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as Record<string, unknown>;
  if (Array.isArray(d.artifacts)) return true;
  if (d.descriptor && typeof d.descriptor === "object" && (d.descriptor as Record<string, unknown>).name === "syft") {
    return true;
  }
  if (
    d.schema &&
    typeof d.schema === "object" &&
    typeof (d.schema as Record<string, unknown>).url === "string" &&
    ((d.schema as Record<string, unknown>).url as string).includes("syft")
  ) {
    return true;
  }
  return false;
}

/**
 * Parses a Syft JSON document and turns artifacts into check items.
 *
 * Artifacts with a valid purl are returned in `items` along with their artifact ID.
 * Artifacts without a purl are tracked in `artifactsWithoutPurl` and never returned as supported items.
 */
export function readSyftDocument(content: string | SyftDocument): SyftReadResult {
  let doc: SyftDocument;
  if (typeof content === "string") {
    try {
      doc = JSON.parse(content) as SyftDocument;
    } catch (err) {
      throw new Error(`Failed to parse Syft JSON document: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    doc = content;
  }

  if (!doc || typeof doc !== "object") {
    throw new Error("Syft document must be a valid JSON object");
  }

  const artifacts = Array.isArray(doc.artifacts) ? doc.artifacts : [];
  const items: SyftCheckItem[] = [];
  let artifactsWithoutPurl = 0;

  for (let i = 0; i < artifacts.length; i++) {
    const art = artifacts[i];
    if (!art || typeof art !== "object") continue;

    const purl = typeof art.purl === "string" ? art.purl.trim() : "";
    if (purl) {
      const version = typeof art.version === "string" ? art.version.trim() : "";
      const id = typeof art.id === "string" && art.id ? art.id : String(art.name || i);
      items.push({
        id,
        purl,
        version,
        artifact: art,
      });
    } else {
      artifactsWithoutPurl++;
    }
  }

  return {
    items,
    artifactsWithoutPurl,
    totalArtifacts: artifacts.length,
    document: doc,
  };
}
