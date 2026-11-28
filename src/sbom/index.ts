import { enrichCycloneDx } from "./cyclonedx.js";
import { type JsonRecord, type SbomSummary, isRecord } from "./model.js";
import { enrichSpdx } from "./spdx.js";

export type SbomFormat = "cyclonedx" | "spdx";

export function enrichSbom(input: unknown, format?: SbomFormat): { document: JsonRecord; summary: SbomSummary } {
  if (!isRecord(input)) throw new Error("Expected a JSON SBOM object.");
  const document = structuredClone(input);
  const summary: SbomSummary = { checked: 0, enriched: 0, notIdentified: [] };
  const cyclonedx = document.bomFormat === "CycloneDX" && ["1.5", "1.6", "1.7"].includes(String(document.specVersion));
  const spdx2 = document.spdxVersion === "SPDX-2.3";
  const context = document["@context"];
  const spdx3 =
    Array.isArray(document["@graph"]) &&
    (Array.isArray(context) ? context : [context]).some(
      (value) =>
        typeof value === "string" && /^https:\/\/spdx\.org\/rdf\/3\.0\.[01]\/spdx-context\.jsonld$/u.test(value),
    );

  if (cyclonedx && format !== "spdx") enrichCycloneDx(document, summary);
  else if ((spdx2 || spdx3) && format !== "cyclonedx") enrichSpdx(document, summary, spdx3);
  else throw new Error("Expected CycloneDX 1.5–1.7 JSON, SPDX 2.3 JSON, or SPDX 3.0 JSON-LD matching --format.");
  return { document, summary };
}
