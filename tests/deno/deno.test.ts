import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { test } from "node:test";

function isDenoAvailable(): boolean {
  try {
    execFileSync("deno", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test("deno: executes isomorphic browser entry with zero permissions", { skip: !isDenoAvailable() }, () => {
  const script = `
    import { check, checkAll, replacementFor, rulesFor } from "./dist/src/browser.js";

    const leftPad = check("pkg:npm/left-pad", "1.3.0");
    if (leftPad.status !== "deprecated") {
      throw new Error("Expected left-pad to be deprecated");
    }

    const replacement = replacementFor("pkg:npm/node-sass", "9.0.0");
    if (replacement !== "pkg:npm/sass") {
      throw new Error("Expected replacement pkg:npm/sass");
    }

    const rules = rulesFor("pkg:npm/left-pad");
    if (rules.length === 0) {
      throw new Error("Expected rules for left-pad");
    }

    const batch = checkAll([
      { purl: "pkg:npm/left-pad", version: "1.3.0" },
      { purl: "pkg:npm/react", version: "18.2.0" },
    ]);
    if (batch.summary.total !== 2 || batch.summary.byStatus.deprecated !== 1) {
      throw new Error("Unexpected batch summary in Deno: " + JSON.stringify(batch.summary));
    }
  `;

  // Runs with zero permission flags
  const output = execFileSync("deno", ["eval", script], {
    encoding: "utf8",
  });
  assert.equal(output.trim(), "");
});

test("deno: executes standard root entry with file permissions", { skip: !isDenoAvailable() }, () => {
  const script = `
    import { check, checkAll, replacementFor } from "./dist/src/index.js";

    const res = check("pkg:npm/request", "2.88.2");
    if (res.status !== "deprecated") {
      throw new Error("Expected request to be deprecated");
    }

    const replacement = replacementFor("pkg:npm/node-sass", "9.0.0");
    if (replacement !== "pkg:npm/sass") {
      throw new Error("Expected replacement pkg:npm/sass");
    }

    const batch = checkAll([
      { purl: "pkg:npm/request", version: "2.88.2" },
      { purl: "pkg:golang/github.com/gin-gonic/gin", version: "1.9.0" },
    ]);
    if (batch.summary.total !== 2) {
      throw new Error("Expected batch of 2");
    }
  `;

  const output = execFileSync("deno", ["eval", script], {
    encoding: "utf8",
  });
  assert.equal(output.trim(), "");
});

test("deno: executes CLI binary under Deno runtime", { skip: !isDenoAvailable() }, () => {
  const okOutput = execFileSync(
    "deno",
    ["run", "--allow-read", "--allow-env", "--allow-sys", "dist/src/cli.js", "check", "pkg:npm/react@18.2.0"],
    { encoding: "utf8" },
  );
  assert.match(okOutput, /react/);

  try {
    execFileSync(
      "deno",
      ["run", "--allow-read", "--allow-env", "--allow-sys", "dist/src/cli.js", "check", "pkg:npm/left-pad@1.3.0"],
      { encoding: "utf8" },
    );
    assert.fail("Expected CLI to exit 1 for deprecated package");
  } catch (err: unknown) {
    const error = err as { status: number; stdout: string };
    assert.equal(error.status, 1);
    assert.match(error.stdout, /left-pad/);
    assert.match(error.stdout, /deprecated/i);
  }
});

test("deno: passes JSR dry-run publication check", { skip: !isDenoAvailable() }, () => {
  const result = spawnSync("deno", ["publish", "--dry-run", "--allow-dirty"], {
    encoding: "utf8",
  });
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.match(combined, /Dry run complete/);
});
