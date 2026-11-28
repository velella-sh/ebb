import {
  type JsonRecord,
  type SbomSummary,
  evidenceComment,
  evidenceFor,
  isEbbReference,
  isRecord,
  previousValue,
  records,
} from "./model.js";

const endOfLife = "cdx:lifecycle:milestone:endOfLife";
const endOfSupport = "cdx:lifecycle:milestone:endOfSupport";

function enrichComponent(component: JsonRecord, summary: SbomSummary): void {
  const evidence = evidenceFor(component, component.purl, component.version, summary);
  const refs = records(component.externalReferences, "externalReferences");
  const old = refs.filter((ref) => ref.type === "evidence" && isEbbReference(ref.url, ref.comment));
  if (!evidence.length && !old.length) return;

  const properties = [...records(component.properties, "properties")];
  for (const ref of old) {
    for (const name of [endOfLife, endOfSupport]) {
      const value = previousValue(ref, name);
      const index = properties.findIndex(
        (property) => value !== undefined && property.name === name && property.value === value,
      );
      if (index !== -1) properties.splice(index, 1);
    }
  }

  const added = evidence.map((entry) => {
    const name =
      entry.event === "end-of-support"
        ? endOfSupport
        : entry.event === "end-of-life" || entry.event === "scheduled-end-of-life"
          ? endOfLife
          : undefined;
    const writes = [];
    if (name && entry.date && !properties.some((property) => property.name === name)) {
      properties.push({ name, value: entry.date });
      writes.push(`${name}=${entry.date}`);
    }
    return { type: "evidence", url: entry.url, comment: evidenceComment(entry, writes) };
  });

  if (properties.length || component.properties !== undefined) component.properties = properties;
  component.externalReferences = [...refs.filter((ref) => !old.includes(ref)), ...added];
}

export function enrichCycloneDx(document: JsonRecord, summary: SbomSummary): void {
  const components = [...records(document.components, "components")];
  if (isRecord(document.metadata) && isRecord(document.metadata.component))
    components.unshift(document.metadata.component);

  for (const component of components) {
    enrichComponent(component, summary);
    for (const child of records(component.components, "components")) components.push(child);
    if (isRecord(component.pedigree)) {
      for (const key of ["ancestors", "descendants", "variants"]) {
        for (const child of records(component.pedigree[key], `pedigree.${key}`)) components.push(child);
      }
    }
  }
}
