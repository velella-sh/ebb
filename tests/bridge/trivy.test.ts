import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { readTrivyReport } from "../../src/bridge/trivy.js";

const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures", "trivy");

test("readTrivyReport parses an image scan report and extracts OS and packages", () => {
  const content = readFileSync(join(FIXTURES_DIR, "image-report.json"), "utf8");
  const parsed = readTrivyReport(content);

  assert.equal(parsed.scanner, "trivy");
  assert.equal(parsed.target, "alpine:3.14");
  assert.equal(parsed.warnings.length, 0);

  // OS purl is extracted
  const osItem = parsed.items.find((item) => item.id === "os:alpine");
  assert.ok(osItem, "Expected OS item for Alpine");
  assert.equal(osItem.name, "alpine");
  assert.equal(osItem.version, "3.14.0");
  assert.equal(osItem.purl, "pkg:generic/alpine@3.14.0");

  // Packages are extracted with IDs and targets
  const musl = parsed.items.find((item) => item.id === "musl@1.2.2-r3");
  assert.ok(musl, "Expected musl package item");
  assert.equal(musl.name, "musl");
  assert.equal(musl.version, "1.2.2-r3");
  assert.equal(musl.purl, "pkg:apk/alpine/musl@1.2.2-r3?arch=x86_64&distro=alpine-3.14.0");
  assert.equal(musl.target, "alpine:3.14 (alpine 3.14.0)");

  // 1 OS item + 3 packages = 4 items
  assert.equal(parsed.items.length, 4);
});

test("readTrivyReport parses a filesystem scan report", () => {
  const content = readFileSync(join(FIXTURES_DIR, "fs-report.json"), "utf8");
  const parsed = readTrivyReport(content);

  assert.equal(parsed.scanner, "trivy");
  assert.equal(parsed.target, "sample-repo");
  assert.equal(parsed.items.length, 3);

  const requestPkg = parsed.items.find((item) => item.name === "request");
  assert.ok(requestPkg);
  assert.equal(requestPkg.id, "request@2.88.2");
  assert.equal(requestPkg.version, "2.88.2");
  assert.equal(requestPkg.purl, "pkg:npm/request@2.88.2");
  assert.equal(requestPkg.target, "package-lock.json");
});

test("readTrivyReport warns clearly when report is generated without --list-all-pkgs", () => {
  const content = readFileSync(join(FIXTURES_DIR, "no-pkgs-report.json"), "utf8");
  const parsed = readTrivyReport(content);

  assert.equal(parsed.scanner, "trivy");
  assert.ok(parsed.warnings.length > 0);
  assert.ok(parsed.warnings[0]);
  assert.match(parsed.warnings[0], /--list-all-pkgs/);

  // OS item is still extracted from metadata
  const osItem = parsed.items.find((item) => item.id === "os:alpine");
  assert.ok(osItem);
  assert.equal(parsed.items.length, 1);
});
