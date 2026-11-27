import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { readGrypeReport, readSyftReport } from "../../src/bridge/grype.js";

const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures", "grype");

test("readGrypeReport reads a recorded Grype report and warns about vulnerable-only list", () => {
  const content = readFileSync(join(FIXTURES_DIR, "image-report.json"), "utf8");
  const parsed = readGrypeReport(content);

  assert.equal(parsed.scanner, "grype");
  assert.equal(parsed.scannerVersion, "0.87.0");
  assert.equal(parsed.target, "alpine:3.14");

  // Emits warning that only vulnerable artifacts are in report
  assert.ok(parsed.warnings.length > 0);
  assert.ok(parsed.warnings[0]);
  assert.match(parsed.warnings[0], /only vulnerable artifacts/);

  // Reads distro as OS generic purl
  const osItem = parsed.items.find((item) => item.id === "os:alpine");
  assert.ok(osItem, "Expected OS item for Alpine distro");
  assert.equal(osItem.version, "3.14.0");
  assert.equal(osItem.purl, "pkg:generic/alpine@3.14.0");

  // Reads matched artifacts
  const musl = parsed.items.find((item) => item.name === "musl");
  assert.ok(musl);
  assert.equal(musl.id, "d2f831a457c2e0b6");
  assert.equal(musl.version, "1.2.2-r3");
  assert.equal(musl.purl, "pkg:apk/alpine/musl@1.2.2-r3?arch=x86_64&distro=alpine-3.14.0");
});

test("readSyftReport reads full package list from a recorded Syft document", () => {
  const content = readFileSync(join(FIXTURES_DIR, "image-syft.json"), "utf8");
  const parsed = readSyftReport(content);

  assert.equal(parsed.scanner, "grype");
  assert.equal(parsed.scannerVersion, "1.19.0");
  assert.equal(parsed.warnings.length, 0);

  // Distro included
  const osItem = parsed.items.find((item) => item.id === "os:alpine");
  assert.ok(osItem);
  assert.equal(osItem.purl, "pkg:generic/alpine@3.14.0");

  // All 4 artifacts + 1 OS item = 5 items
  assert.equal(parsed.items.length, 5);

  const baselayout = parsed.items.find((item) => item.name === "alpine-baselayout");
  assert.ok(baselayout);
  assert.equal(baselayout.id, "e3a942b568d3f1c7");
});

test("readGrypeReport automatically delegates to Syft reader when passed a Syft document", () => {
  const content = readFileSync(join(FIXTURES_DIR, "image-syft.json"), "utf8");
  const parsed = readGrypeReport(content);

  assert.equal(parsed.scanner, "grype");
  assert.equal(parsed.items.length, 5);
  assert.equal(parsed.warnings.length, 0);
});
