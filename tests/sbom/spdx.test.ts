import assert from "node:assert/strict";
import test from "node:test";

import { enrichSbom } from "../../src/sbom/index.js";

const purl = "pkg:npm/node-sass@9.0.0";
const eol = "https://velella.sh/ebb/api/v1/rules/npm.package.node-sass.eol.json";
const timestamp = "2024-07-24T00:00:00Z";

test("SPDX 2.3 keeps SPDX package data and adds a valid-until date and rule references", () => {
  const input = {
    spdxVersion: "SPDX-2.3",
    packages: [
      {
        SPDXID: "SPDXRef-sass",
        name: "node-sass",
        versionInfo: "9.0.0",
        licenseConcluded: "MIT",
        externalRefs: [{ referenceCategory: "PACKAGE-MANAGER", referenceType: "purl", referenceLocator: purl }],
      },
    ],
    relationships: [
      { relationshipType: "DESCRIBES", spdxElementId: "SPDXRef-DOCUMENT", relatedSpdxElement: "SPDXRef-sass" },
    ],
  };
  const result = enrichSbom(input, "spdx");
  const document = result.document as typeof input & { packages: { validUntilDate?: string }[] };
  const pkg = document.packages[0];
  assert.equal(pkg?.validUntilDate, timestamp);
  assert.equal(pkg?.licenseConcluded, "MIT");
  assert.deepEqual(pkg?.externalRefs[0], input.packages[0]?.externalRefs[0]);
  assert.ok(pkg?.externalRefs.some((ref) => ref.referenceCategory === "OTHER" && ref.referenceLocator === eol));
  assert.deepEqual(document.relationships, input.relationships);
  assert.deepEqual(enrichSbom(document), result);
  assert.equal(JSON.stringify(enrichSbom(document).document), JSON.stringify(document));
});

test("SPDX 3.0 JSON-LD enriches packages identified by the software field or a packageUrl external identifier", () => {
  const input = {
    "@context": "https://spdx.org/rdf/3.0.1/spdx-context.jsonld",
    "@graph": [
      { type: "software_Package", spdxId: "urn:example:sass", name: "node-sass", software_packageUrl: purl },
      {
        type: "software_Package",
        spdxId: "urn:example:sass-other",
        name: "node-sass",
        externalIdentifier: [{ type: "ExternalIdentifier", externalIdentifierType: "packageUrl", identifier: purl }],
        validUntilTime: "2025-01-01T12:30:00Z",
        supportLevel: ["limitedSupport"],
      },
      { type: "Relationship", spdxId: "urn:example:relationship" },
    ],
  };
  const result = enrichSbom(input);
  const document = result.document as typeof input & {
    "@graph": { externalRef?: { locator: string[]; externalRefType: string }[] }[];
  };
  const [pkg, supplied, relationship] = document["@graph"];
  assert.deepEqual(result.summary, { checked: 2, enriched: 2, notIdentified: [] });
  assert.equal(pkg?.validUntilTime, timestamp);
  assert.deepEqual(pkg?.supportLevel, ["endOfSupport"]);
  assert.ok(pkg?.externalRef?.some((ref) => ref.externalRefType === "eolNotice" && ref.locator[0] === eol));
  assert.equal(supplied?.validUntilTime, "2025-01-01T12:30:00Z");
  assert.deepEqual(supplied?.supportLevel, ["limitedSupport"]);
  assert.deepEqual(relationship, input["@graph"][2]);
  assert.deepEqual(enrichSbom(document), result);
  assert.equal(JSON.stringify(enrichSbom(document).document), JSON.stringify(document));
});
