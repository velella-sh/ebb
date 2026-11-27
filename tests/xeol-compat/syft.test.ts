import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { type SyftCheckItem, isSyftDocument, readSyftDocument } from "../../src/xeol/syft.js";

const repoRoot = resolve(process.cwd());
const v0Path = resolve(repoRoot, "tests/fixtures/syft/syft-v0.json");
const v1Path = resolve(repoRoot, "tests/fixtures/syft/syft-v1.json");

describe("xeol-compat-2: Read Syft JSON documents", () => {
  it("detects Syft document structures", () => {
    const v0Content = readFileSync(v0Path, "utf-8");
    const parsed = JSON.parse(v0Content);

    assert.equal(isSyftDocument(parsed), true);
    assert.equal(isSyftDocument({ artifacts: [] }), true);
    assert.equal(isSyftDocument({ descriptor: { name: "syft" } }), true);
    assert.equal(isSyftDocument({ packages: [] }), false);
    assert.equal(isSyftDocument(null), false);
    assert.equal(isSyftDocument("not-an-object"), false);
  });

  it("reads Syft v0.x document and counts match fixture exactly", () => {
    const raw = readFileSync(v0Path, "utf-8");
    const res = readSyftDocument(raw);

    assert.equal(res.totalArtifacts, 3);
    assert.equal(res.items.length, 2);
    assert.equal(res.artifactsWithoutPurl, 1);

    // Verify first item
    const item0 = res.items[0]!;
    assert.equal(item0.id, "art-v0-1");
    assert.equal(item0.purl, "pkg:apk/alpine/alpine-baselayout@3.2.0-r6?arch=x86_64");
    assert.equal(item0.version, "3.2.0-r6");
    assert.equal(item0.artifact.name, "alpine-baselayout");

    // Verify second item
    const item1 = res.items[1]!;
    assert.equal(item1.id, "art-v0-2");
    assert.equal(item1.purl, "pkg:apk/alpine/busybox@1.33.1-r6?arch=x86_64");
    assert.equal(item1.version, "1.33.1-r6");

    // Ensure Syft metadata is preserved
    assert.equal(res.document.descriptor?.version, "0.23.0");
    assert.equal(res.document.distro?.name, "alpine");
  });

  it("reads Syft v1.x document and counts match fixture exactly", () => {
    const raw = readFileSync(v1Path, "utf-8");
    const res = readSyftDocument(raw);

    assert.equal(res.totalArtifacts, 5);
    assert.equal(res.items.length, 4);
    assert.equal(res.artifactsWithoutPurl, 1);

    const busybox = res.items.find((i: SyftCheckItem) => i.artifact.name === "busybox");
    assert.ok(busybox);
    assert.equal(busybox.id, "c1f729e248b1dca5");
    assert.equal(busybox.version, "1.33.1-r6");
    assert.equal(busybox.artifact.type, "apk");

    const musl = res.items.find((i: SyftCheckItem) => i.artifact.name === "musl");
    assert.ok(musl);
    assert.equal(musl.id, "d2f831a457c2e0b6");

    assert.equal(res.document.descriptor?.version, "1.10.0");
    assert.equal(res.document.source?.type, "image");
  });

  it("throws on malformed JSON or invalid document", () => {
    assert.throws(() => readSyftDocument("invalid json"), /Failed to parse Syft JSON document/);
    assert.throws(() => readSyftDocument(123 as unknown as string), /Syft document must be a valid JSON object/);
  });
});
