import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function isBunAvailable(): boolean {
  try {
    execFileSync("bun", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test("bun: executes root entry point and verifies lifecycle verdicts", { skip: !isBunAvailable() }, () => {
  const script = `
    import { check, checkAll, replacementFor, rulesFor } from "./dist/src/index.js";

    const leftPad = check("pkg:npm/left-pad", "1.3.0");
    if (leftPad.status !== "deprecated") {
      throw new Error("Expected left-pad to be deprecated in Bun");
    }

    const replacement = replacementFor("pkg:npm/node-sass", "9.0.0");
    if (replacement !== "pkg:npm/sass") {
      throw new Error("Expected node-sass replacement to be sass");
    }

    const rules = rulesFor("pkg:npm/left-pad");
    if (rules.length === 0) {
      throw new Error("Expected rules for left-pad in Bun");
    }

    const batch = checkAll([
      { purl: "pkg:npm/left-pad", version: "1.3.0" },
      { purl: "pkg:npm/react", version: "18.2.0" },
      { purl: "pkg:golang/github.com/gin-gonic/gin", version: "1.9.0" },
    ]);
    if (batch.summary.total !== 3 || batch.summary.byStatus.deprecated !== 1) {
      throw new Error("Unexpected batch summary in Bun");
    }
  `;

  const output = execFileSync("bun", ["-e", script], {
    encoding: "utf8",
  });
  assert.equal(output.trim(), "");
});

test("bun: measures startup / load time under Bun", { skip: !isBunAvailable() }, () => {
  const start = performance.now();
  execFileSync("bun", ["-e", 'import "./dist/src/index.js";'], {
    encoding: "utf8",
  });
  const elapsedMs = performance.now() - start;

  // Bun cold process start + import should easily finish in well under 250ms
  assert.ok(elapsedMs < 250, `Bun startup time ${elapsedMs}ms took too long`);
});

test("bun: executes CLI check under Bun runtime", { skip: !isBunAvailable() }, () => {
  const okOutput = execFileSync("bun", ["run", "dist/src/cli.js", "check", "pkg:npm/react@18.2.0"], {
    encoding: "utf8",
  });
  assert.match(okOutput, /react/);

  try {
    execFileSync("bun", ["run", "dist/src/cli.js", "check", "pkg:npm/left-pad@1.3.0"], {
      encoding: "utf8",
    });
    assert.fail("Expected CLI to exit 1 for deprecated package");
  } catch (err: unknown) {
    const error = err as { status: number; stdout: string };
    assert.equal(error.status, 1);
    assert.match(error.stdout, /left-pad/);
    assert.match(error.stdout, /deprecated/i);
  }
});

test("bun: installs and imports from packed tarball in isolated directory", { skip: !isBunAvailable() }, () => {
  const tempDir = mkdtempSync(join(tmpdir(), "ebb-bun-test-"));
  try {
    // Pack current repo
    const packOutput = execFileSync("npm", ["pack", "--silent"], {
      encoding: "utf8",
    }).trim();
    const tarballPath = join(process.cwd(), packOutput);

    // Initialize package and add packed tarball in temp dir
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "bun-consumer", type: "module" }, null, 2));

    execFileSync("bun", ["add", tarballPath], {
      cwd: tempDir,
      stdio: "pipe",
    });

    const testConsumer = `
      import { check, replacementFor } from "@velella/ebb";

      const res = check("pkg:npm/request", "2.88.2");
      if (res.status !== "deprecated") process.exit(1);

      const repl = replacementFor("pkg:npm/node-sass", "9.0.0");
      if (repl !== "pkg:npm/sass") process.exit(2);

      console.log("BUN_TARBALL_SUCCESS");
    `;

    writeFileSync(join(tempDir, "consumer.js"), testConsumer);
    const consumerOutput = execFileSync("bun", ["run", "consumer.js"], {
      cwd: tempDir,
      encoding: "utf8",
    });

    assert.match(consumerOutput, /BUN_TARBALL_SUCCESS/);

    // Cleanup tarball
    rmSync(tarballPath, { force: true });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
