import assert from "node:assert/strict";
import { test } from "node:test";
import { DECLARED_CANDIDATES } from "../../tools/importers/declared-candidates.js";
import { readNpmDeclarations } from "../../tools/importers/declared.js";
import { readRecording, replayContext } from "../../tools/importers/recording.js";
import { ImporterError } from "../../tools/importers/types.js";

const sha = "1234567890abcdef1234567890abcdef12345678";
const npm = (name: string) => ({ ecosystem: "npm", name }) as const;

test("keeps Ebb first and the remaining reviewed inputs unique and sorted", () => {
  const [first, ...others] = DECLARED_CANDIDATES;
  assert.equal(first?.name, "@velella/ebb");
  const keys = others.map(({ ecosystem, name }) => `${ecosystem}:${name}`);
  assert.deepEqual(keys, [...new Set(keys)].sort());
  for (const required of ["npm:request", "npm:@hapi/joi", "npm:typescript", "pypi:django", "pypi:pip"]) {
    assert.ok(keys.includes(required), required);
  }
  assert.ok(DECLARED_CANDIDATES.every(({ reason }) => reason.trim()));
});

test("replays inline metadata and a monorepo declaration pinned to the published commit", async () => {
  const fixture = await readRecording("tests/importers/recordings/declared-npm.json");
  assert.equal(fixture.synthetic, true);
  const replay = replayContext(fixture);
  const result = await readNpmDeclarations(replay, [
    npm("inline-fixture"),
    npm("@example/path"),
    npm("unpublished-head-fixture"),
    npm("traversal-fixture"),
    npm("wrong-forge-fixture"),
    npm("missing-pinned-fixture"),
    npm("no-declaration-fixture"),
    { ecosystem: "pypi", name: "replay-must-not-try-this" },
  ]);
  const [inline, path] = result.declarations;
  assert.equal(result.declarations.length, 2);
  assert.deepEqual(inline, {
    package: "inline-fixture",
    version: "1.2.3",
    source: "https://registry.npmjs.org/inline-fixture/latest",
    declaration: { lines: [{ versions: "vers:npm/>=1.0.0|<2.0.0", endOfSupport: "2026-07-31" }] },
  });
  assert.equal(path?.package, "@example/path");
  assert.equal(path?.version, "2.0.0");
  assert.equal(path?.commit, sha);
  assert.equal(
    path?.source,
    `https://raw.githubusercontent.com/example-org/fixture/${sha}/packages/path/meta/lifecycle.json`,
  );
  assert.equal(path.declaration.component, "pkg:npm/%40example/path");
  assert.deepEqual(
    result.notes.map((note) => note.split("@")[0]),
    [
      "Skipped unpublished-head-fixture",
      "Skipped traversal-fixture",
      "Skipped wrong-forge-fixture",
      "Skipped missing-pinned-fixture",
    ],
  );
  assert.match(result.notes[3] ?? "", /unavailable at published commit/u);
  assert.deepEqual(replay.unused(), []);
});

test("does not conceal registry or GitHub service failures as missing declarations", async () => {
  await assert.rejects(
    readNpmDeclarations(
      {
        now: new Date("2026-11-28"),
        fetchText: async () => {
          throw new ImporterError("GET failed: HTTP 429");
        },
      },
      [npm("inline-fixture")],
    ),
    /HTTP 429/u,
  );
});
