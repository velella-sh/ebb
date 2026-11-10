import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPurl, normalizePurl, parsePurl, PurlError, purlIdentity } from "../src/purl.js";

test("round-trips canonical PURLs for every supported type", async (t) => {
  for (const purl of [
    "pkg:npm/request@2.88.2",
    "pkg:npm/%40angular/core@17.0.0",
    "pkg:pypi/django-nose@1.4.7",
    "pkg:golang/github.com/gorilla/mux@v1.8.1",
    "pkg:cargo/serde@1.0.197",
    "pkg:maven/org.springframework.boot/spring-boot@3.2.0",
    "pkg:nuget/Newtonsoft.Json@13.0.3",
    "pkg:gem/rails@7.1.3",
    "pkg:composer/laravel/framework@10.0.0",
    "pkg:pub/flutter_bloc@8.1.3",
    "pkg:swift/github.com/Alamofire/Alamofire@5.8.1",
    "pkg:docker/library/node@20?repository_url=docker.io",
    "pkg:github/actions/checkout@v4",
    "pkg:generic/nodejs@20.11.0",
  ]) {
    await t.test(purl, () => {
      assert.equal(normalizePurl(purl), purl);
      assert.equal(formatPurl(parsePurl(purl)), purl);
    });
  }
});

test("parses every component", () => {
  assert.deepEqual(parsePurl("pkg:maven/org.apache/commons-lang3@3.14.0?classifier=sources&type=jar#src/main"), {
    type: "maven",
    namespace: "org.apache",
    name: "commons-lang3",
    version: "3.14.0",
    qualifiers: { classifier: "sources", type: "jar" },
    subpath: "src/main",
  });
});

test("applies type-specific normalization", () => {
  assert.equal(normalizePurl("pkg:PyPI/Django_Nose"), "pkg:pypi/django-nose");
  assert.equal(normalizePurl("pkg:npm/%40Angular/Core"), "pkg:npm/%40angular/core");
  assert.equal(normalizePurl("pkg:github/Actions/Checkout"), "pkg:github/actions/checkout");
  assert.equal(normalizePurl("pkg:composer/Laravel/Framework"), "pkg:composer/laravel/framework");
  assert.equal(normalizePurl("pkg:maven/Org.Apache/Commons"), "pkg:maven/Org.Apache/Commons");
  assert.equal(normalizePurl("pkg:nuget/Newtonsoft.Json"), "pkg:nuget/Newtonsoft.Json");
});

test("sorts qualifiers and drops empty values", () => {
  assert.equal(normalizePurl("pkg:docker/node?tag=&arch=amd64&os=linux"), "pkg:docker/node?arch=amd64&os=linux");
});

test("lowercases qualifier keys and rejects an invalid or duplicate key", () => {
  assert.equal(
    normalizePurl("pkg:gem/jruby-launcher@1.1.2?Platform=java"),
    "pkg:gem/jruby-launcher@1.1.2?platform=java",
  );
  assert.throws(() => parsePurl("pkg:npm/myartifact@1.0.0?in%20production=true"), PurlError);
  assert.throws(
    () => formatPurl({ type: "npm", name: "myartifact", version: "1.0.0", qualifiers: { "in production": "true" } }),
    PurlError,
  );
  assert.throws(() => parsePurl("pkg:npm/myartifact@1.0.0?arch=x64&arch=arm64"), PurlError);
  assert.throws(
    () => formatPurl({ type: "npm", name: "myartifact", qualifiers: { Arch: "x64", arch: "arm64" } }),
    PurlError,
  );
});

test("strips empty, '.', and '..' subpath segments and rejects an encoded slash", () => {
  assert.deepEqual(parsePurl("pkg:golang/google.golang.org/genproto#/googleapis/api/annotations/"), {
    type: "golang",
    namespace: "google.golang.org",
    name: "genproto",
    subpath: "googleapis/api/annotations",
  });
  // `.` and `..` are discarded as segments; they are not path-resolved.
  assert.deepEqual(parsePurl("pkg:npm/core@2.0.1#./googleapis/../api/./annotations/.."), {
    type: "npm",
    name: "core",
    version: "2.0.1",
    subpath: "googleapis/api/annotations",
  });
  assert.equal(
    formatPurl({
      type: "npm",
      name: "core",
      version: "2.0.1",
      subpath: "/googleapis/./api/../annotations/",
    }),
    "pkg:npm/core@2.0.1#googleapis/api/annotations",
  );
  assert.throws(() => parsePurl("pkg:npm/core@1.0.0#foo%2Fbar"), PurlError);
  assert.throws(() => parsePurl("pkg:maven/@1.3.4"), PurlError);
});

test("an '@' at the start of the path is not a version separator", () => {
  assert.deepEqual(parsePurl("pkg:npm/@babel/core#/googleapis/api/annotations/"), {
    type: "npm",
    namespace: "@babel",
    name: "core",
    subpath: "googleapis/api/annotations",
  });
  assert.equal(
    normalizePurl("pkg:npm/@babel/core#/googleapis/api/annotations/"),
    "pkg:npm/%40babel/core#googleapis/api/annotations",
  );
});

test("returns the version-less identity used by registry rules", () => {
  assert.equal(purlIdentity("pkg:npm/%40angular/core@17.0.0?foo=bar#x"), "pkg:npm/%40angular/core");
  assert.equal(purlIdentity({ type: "pypi", name: "Django_Nose" }), "pkg:pypi/django-nose");
});

test("rejects malformed PURLs", async (t) => {
  for (const value of ["npm/request", "pkg:", "pkg:npm", "pkg:npm/", "pkg:1npm/request", "pkg:npm/%E0%A4%A"]) {
    await t.test(value, () => assert.throws(() => parsePurl(value), PurlError));
  }
});

test("drops trailing slashes from the path", () => {
  assert.deepEqual(parsePurl("pkg:npm/request@2.88.2///"), { type: "npm", name: "request", version: "2.88.2" });
  assert.deepEqual(parsePurl("pkg:maven/org.apache/commons-lang3///"), {
    type: "maven",
    namespace: "org.apache",
    name: "commons-lang3",
  });
});

test("a PURL with a long run of slashes parses in linear time", () => {
  const value = `pkg:npm/${"/".repeat(100_000)}request@2.88.2`;
  const started = performance.now();
  const parsed = parsePurl(value);
  const elapsed = performance.now() - started;
  assert.deepEqual(parsed, { type: "npm", name: "request", version: "2.88.2" });
  assert.ok(elapsed < 1000, `a 100k-slash PURL took ${elapsed.toFixed(1)}ms`);
});
