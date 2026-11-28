import {
  type JsonRecord,
  type SbomSummary,
  evidenceComment,
  evidenceFor,
  isEbbReference,
  isRecord,
  isSupportDeadline,
  previousValue,
  records,
} from "./model.js";

const spdx2ReferenceType = "LocationRef-ebb-lifecycle";
const supportLevel = "endOfSupport";

function jsonLdRecords(value: unknown, key: string): JsonRecord[] {
  return isRecord(value) ? [value] : records(value, key);
}

function enrichPackage(pkg: JsonRecord, summary: SbomSummary, spdx3: boolean): void {
  const refKey = spdx3 ? "externalRef" : "externalRefs";
  const refs = spdx3 ? jsonLdRecords(pkg[refKey], refKey) : records(pkg[refKey], refKey);
  const old = refs.filter((ref) => {
    if (spdx3) {
      const locator = Array.isArray(ref.locator) ? ref.locator[0] : ref.locator;
      return ref.type === "ExternalRef" && isEbbReference(locator, ref.comment);
    }
    return (
      ref.referenceCategory === "OTHER" &&
      ref.referenceType === spdx2ReferenceType &&
      isEbbReference(ref.referenceLocator, ref.comment)
    );
  });
  let purl = pkg.software_packageUrl;
  if (spdx3 && purl === undefined) {
    const identifiers = jsonLdRecords(pkg.externalIdentifier, "externalIdentifier");
    purl = identifiers.find((id) => id.externalIdentifierType === "packageUrl")?.identifier;
  } else if (!spdx3) {
    const identity = refs.find((ref) => ref.referenceCategory === "PACKAGE-MANAGER" && ref.referenceType === "purl");
    purl = identity?.referenceLocator;
  }
  const evidence = evidenceFor(pkg, purl, spdx3 ? pkg.software_packageVersion : pkg.versionInfo, summary);
  if (!old.length && !evidence.length) return;

  const dateKey = spdx3 ? "validUntilTime" : "validUntilDate";
  const ownedDate = typeof pkg[dateKey] === "string" && old.some((ref) => previousValue(ref, dateKey) === pkg[dateKey]);
  const ownedSupport =
    spdx3 &&
    Array.isArray(pkg.supportLevel) &&
    pkg.supportLevel.length === 1 &&
    pkg.supportLevel[0] === supportLevel &&
    old.some((ref) => previousValue(ref, "supportLevel") === supportLevel);
  let date = ownedDate ? undefined : pkg[dateKey];
  let support = ownedSupport ? undefined : pkg.supportLevel;

  const added = evidence.map((entry) => {
    const writes = [];
    if (entry.date && isSupportDeadline(entry) && date === undefined) {
      const timestamp = `${entry.date}T00:00:00Z`;
      date = timestamp;
      writes.push(`${dateKey}=${timestamp}`);
      if (spdx3 && support === undefined) {
        support = [supportLevel];
        writes.push(`supportLevel=${supportLevel}`);
      }
    }
    const comment = evidenceComment(entry, writes);
    if (spdx3) {
      return {
        type: "ExternalRef",
        externalRefType: ["end-of-life", "scheduled-end-of-life"].includes(entry.event) ? "eolNotice" : "other",
        locator: [entry.url],
        comment,
      };
    }
    return { referenceCategory: "OTHER", referenceType: spdx2ReferenceType, referenceLocator: entry.url, comment };
  });
  if (date !== undefined) pkg[dateKey] = date;
  else if (ownedDate) delete pkg[dateKey];
  if (spdx3 && support !== undefined) pkg.supportLevel = support;
  else if (ownedSupport) delete pkg.supportLevel;
  pkg[refKey] = [...refs.filter((ref) => !old.includes(ref)), ...added];
}

export function enrichSpdx(document: JsonRecord, summary: SbomSummary, spdx3: boolean): void {
  const packages = spdx3
    ? records(document["@graph"], "@graph").filter((node) =>
        Array.isArray(node.type) ? node.type.includes("software_Package") : node.type === "software_Package",
      )
    : records(document.packages, "packages");
  for (const pkg of packages) enrichPackage(pkg, summary, spdx3);
}
