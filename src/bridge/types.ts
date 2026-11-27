import type { CheckEvent, CheckStatus } from "../check.js";

/**
 * A package or OS component extracted from a scanner report.
 */
export interface BridgePackageItem {
  /** Identifier from the scanner report (e.g. pkg.ID or artifact.id) */
  id: string;
  name: string;
  version: string;
  purl?: string | undefined;
  target: string;
}

/**
 * Normalized input parsed from a scanner report.
 */
export interface ScannerBridgeInput {
  scanner: "trivy" | "grype";
  scannerVersion: string;
  target: string;
  items: BridgePackageItem[];
  warnings: string[];
  rawReport: Record<string, unknown>;
}

/**
 * Counts of evaluated packages by lifecycle classification.
 */
export interface BridgeCounts {
  /** Total number of packages with purl evaluated */
  checked: number;
  /** Number of packages reaching end-of-life */
  endOfLife: number;
  /** Number of deprecated packages */
  deprecated: number;
  /** Packages evaluated with no registered lifecycle rules */
  unknown: number;
  /** Discovered packages lacking a Package URL (PURL) */
  withoutPurl: number;
  "end-of-life"?: number;
  "without-purl"?: number;
}

/**
 * Individual package lifecycle finding pointing back to scanner ID.
 */
export interface BridgeLifecycleEntry {
  packageId: string;
  name: string;
  version: string;
  purl?: string | undefined;
  target: string;
  status: CheckStatus | "unknown" | "without-purl";
  event?: CheckEvent | undefined;
  deadline?: string | null | undefined;
  replacement?: string | null | undefined;
  ruleId?: string | undefined;
  severity?: string | undefined;
  title?: string | undefined;
  summary?: string | undefined;
}

/**
 * Combined scanner and lifecycle report.
 */
export interface CombinedBridgeReport {
  scanner: "trivy" | "grype";
  scannerVersion: string;
  target: string;
  counts: BridgeCounts;
  lifecycle: BridgeLifecycleEntry[];
  warnings: string[];
  rawReport: Record<string, unknown>;
}
