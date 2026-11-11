import assert from "node:assert/strict";
import { test } from "node:test";

import { formatVers, normalizeVers, parseVers, parseVersLenient, VersError } from "../../src/vers/index.js";

test("canonical parse enforces lowercase scheme, uppercase percent-encoding, and no unencoded comparators", () => {
  assert.throws(
    () => parseVers("VERS:npm/1.0.0"),
    (err: unknown) => err instanceof VersError,
  );
  assert.throws(() => parseVers("vers:NPM/1.0.0"), /must be lowercase/);
  assert.throws(() => parseVers("vers:npm/1.0%2f0"), /percent-encoding in version is not canonical/);
  assert.throws(() => parseVers("vers:npm/1%092"), /whitespace is not permitted/);
  assert.throws(() => parseVers("vers:npm/1%0A2"), /whitespace is not permitted/);
  assert.throws(() => parseVers("vers:npm/1.0!beta"), /unencoded reserved character/);
  assert.throws(() => parseVers("vers:npm/1.0*2"), /unencoded reserved character/);
  assert.throws(() => parseVers("vers:npm/>=1.0<2.0"), /unencoded reserved character/);
  assert.throws(() => parseVers("vers:npm/1.0=2"), /unencoded reserved character/);
  assert.deepEqual(parseVers("vers:npm/1%202"), {
    scheme: "npm",
    constraints: [{ comparator: "=", version: "1 2" }],
    all: false,
  });
});

test("lenient normalisation preserves version spaces as %20, lowercases scheme, strips separator whitespace, and sorts", () => {
  assert.equal(normalizeVers("VERS:NPM/ >= 2.0.0 | = 1.0.0 "), "vers:npm/1.0.0|>=2.0.0");
  assert.equal(normalizeVers("vers:npm/1 2"), "vers:npm/1%202");
  assert.equal(normalizeVers("vers:npm/1.0%2f0"), "vers:npm/1.0%2F0");
  assert.equal(normalizeVers("vers:pypi/0.0.2|0.0.6|>=0.0.0|0.0.1"), "vers:pypi/>=0.0.0|0.0.1|0.0.2|0.0.6");
  assert.equal(normalizeVers("vers:npm/ * "), "vers:npm/*");

  assert.throws(() => parseVersLenient("vers:npm/1%092"), /whitespace is not permitted/);
  assert.throws(() => parseVersLenient("vers:npm/1\t2"), /whitespace is not permitted/);
  assert.throws(() => parseVersLenient("vers:npm/1.0 | | 2.0"), /consecutive pipes/);
  assert.throws(() => parseVersLenient("vers:npm/ | 1.0"), /leading pipe/);
  assert.throws(() => parseVersLenient("vers:npm/1.0 | "), /trailing pipe/);
});

test("formatVers percent-encodes reserved ! and *, and lowercases scheme", () => {
  assert.equal(
    formatVers({
      scheme: "NPM",
      constraints: [{ comparator: "=", version: "1.0.0!beta*1" }],
      all: false,
    }),
    "vers:npm/1.0.0%21beta%2A1",
  );
  assert.equal(
    formatVers({
      scheme: "NPM",
      constraints: [],
      all: true,
    }),
    "vers:npm/*",
  );
  assert.equal(formatVers(parseVers("vers:npm/%2A")), "vers:npm/%2A");
  assert.equal(formatVers(parseVers("vers:npm/%21")), "vers:npm/%21");
});
