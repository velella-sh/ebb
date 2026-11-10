import assert from "node:assert/strict";
import { test } from "node:test";

import { EbbError } from "../../src/errors.js";
import { formatPurl, parsePurl, PurlError } from "../../src/purl.js";

/**
 * Invalid cases drawn from the unit suite and the structural failures in the
 * vendored purl-spec fixtures. Each message must name the concrete problem.
 */
const INVALID_PARSE_CASES: ReadonlyArray<{ value: string; message: string }> = [
  { value: "npm/request", message: 'PURL must start with "pkg:": npm/request' },
  {
    value: "EnterpriseLibrary.Common@6.0.1304",
    message: 'PURL must start with "pkg:": EnterpriseLibrary.Common@6.0.1304',
  },
  {
    value: "pkg%3Amaven/org.apache.commons/io",
    message: 'PURL must start with "pkg:": pkg%3Amaven/org.apache.commons/io',
  },
  { value: "pkg:", message: "PURL is missing a type: pkg:" },
  { value: "pkg:npm", message: "PURL is missing a name: pkg:npm" },
  { value: "pkg:npm/", message: "PURL is missing a name: pkg:npm/" },
  { value: "pkg:hackage", message: "PURL is missing a name: pkg:hackage" },
  {
    value: "pkg:EnterpriseLibrary.Common@6.0.1304",
    message: "PURL is missing a name: pkg:EnterpriseLibrary.Common@6.0.1304",
  },
  { value: "pkg:maven/@1.3.4", message: "PURL is missing a name: pkg:maven/@1.3.4" },
  { value: "pkg:cran/@0.9.1", message: "PURL is missing a name: pkg:cran/@0.9.1" },
  { value: "pkg:1npm/request", message: 'Invalid PURL type "1npm".' },
  { value: "pkg:3nginx/nginx@0.8.9", message: 'Invalid PURL type "3nginx".' },
  { value: "pkg:nginx:a/nginx@0.8.9", message: 'Invalid PURL type "nginx:a".' },
  { value: "pkg:n&g?inx/nginx@0.8.9", message: 'Invalid PURL type "n&g".' },
  {
    value: "pkg:npm/%E0%A4%A",
    message: 'Invalid percent-encoding in "%E0%A4%A".',
  },
  {
    value: "pkg:npm/myartifact@1.0.0?in%20production=true",
    message: 'Invalid qualifier key "in%20production".',
  },
  {
    value: "pkg:gem/jruby-launcher@1.1.2?Platform=java",
    message: 'Qualifier key "Platform" must be lowercase in pkg:gem/jruby-launcher@1.1.2?Platform=java',
  },
  {
    value: "pkg:npm/myartifact@1.0.0?arch=x64&arch=arm64",
    message: 'Duplicate qualifier key "arch" in pkg:npm/myartifact@1.0.0?arch=x64&arch=arm64',
  },
  {
    value: "pkg:npm/x?foo",
    message: 'Invalid qualifier "foo": missing "=" in pkg:npm/x?foo',
  },
  {
    value: "pkg:npm/x?=1",
    message: 'Invalid qualifier "=1": missing key in pkg:npm/x?=1',
  },
  {
    value: "pkg:npm/core@1.0.0#foo%2Fbar",
    message: 'Invalid subpath segment "foo%2Fbar".',
  },
];

test("each invalid PURL names the problem", async (t) => {
  for (const { value, message } of INVALID_PARSE_CASES) {
    await t.test(value, () => {
      assert.throws(
        () => parsePurl(value),
        (error: unknown) => {
          assert.ok(error instanceof PurlError);
          assert.ok(error instanceof EbbError);
          assert.equal(error.code, "invalid-purl");
          assert.equal(error.message, message);
          return true;
        },
      );
    });
  }
});

test("formatPurl names invalid type, name, and qualifier problems", () => {
  assert.throws(
    () => formatPurl({ type: "1npm", name: "request" }),
    (error: unknown) => {
      assert.ok(error instanceof PurlError);
      assert.equal(error.code, "invalid-purl");
      assert.equal(error.message, 'Invalid PURL type "1npm".');
      return true;
    },
  );
  assert.throws(
    () => formatPurl({ type: "npm", name: "" }),
    (error: unknown) => {
      assert.ok(error instanceof PurlError);
      assert.equal(error.message, "PURL name is required.");
      return true;
    },
  );
  assert.throws(
    () => formatPurl({ type: "npm", name: "x", qualifiers: { "in production": "true" } }),
    (error: unknown) => {
      assert.ok(error instanceof PurlError);
      assert.equal(error.message, 'Invalid qualifier key "in production".');
      return true;
    },
  );
  assert.throws(
    () => formatPurl({ type: "npm", name: "x", qualifiers: { Arch: "x64", arch: "arm64" } }),
    (error: unknown) => {
      assert.ok(error instanceof PurlError);
      assert.equal(error.message, 'Duplicate qualifier key "arch".');
      return true;
    },
  );
});
