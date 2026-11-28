import type { RegistryV2Rule } from "../../src/registry.js";

export const asOf = "2026-11-28";
export const dataVersion = "2026.11.11";
export const oldSource = "https://vendor.example.com/older";
export const newSource = "https://vendor.example.com/newer";

export const rule = (id: string, fields: Partial<RegistryV2Rule> = {}): RegistryV2Rule => ({
  id,
  ecosystem: "nodejs",
  purl: "pkg:generic/nodejs",
  vers: "vers:semver/>=22.0.0|<23.0.0",
  title: "Node fixture",
  summary: "A fixture with reproducible dates.",
  event: "scheduled-end-of-life",
  severity: "medium",
  confidence: "confirmed",
  deadline: "2027-01-31",
  sources: [{ title: "Vendor", url: oldSource }],
  provenance: { observedAt: "2025-10-01", reviewedAt: "2026-11-01", reviewer: "fixture", method: "manual" },
  ...fields,
});
