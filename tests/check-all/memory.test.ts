import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const checkModuleUrl = pathToFileURL(fileURLToPath(new URL("../../src/check.js", import.meta.url))).href;
const checkAllModuleUrl = pathToFileURL(fileURLToPath(new URL("../../src/check-all.js", import.meta.url))).href;

interface MemoryReport {
  inputBytes: number;
  peakBytes: number;
  retainedBytes: number;
  total: number;
}

function measureBatchInSubprocess(uniqueCount: number, asGenerator: boolean): MemoryReport {
  const script = `
    import { check } from ${JSON.stringify(checkModuleUrl)};
    import { checkAll, checkAllWith } from ${JSON.stringify(checkAllModuleUrl)};

    const COUNT = 100_000;
    const uniqueCount = ${uniqueCount};
    const asGenerator = ${String(asGenerator)};

    check("pkg:npm/request", "2.88.2");
    globalThis.gc();
    globalThis.gc();

    const beforeInput = process.memoryUsage().heapUsed;
    const source = new Array(COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      const slot = i % uniqueCount;
      source[i] = {
        purl: "pkg:npm/example-" + slot,
        version: "1." + Math.floor(slot / 100) + "." + (slot % 100),
      };
    }
    globalThis.gc();
    globalThis.gc();
    const afterInput = process.memoryUsage().heapUsed;
    const inputBytes = afterInput - beforeInput;

    let seen = 0;
    let peakBytes = 0;
    function* stream() {
      yield* source;
    }

    const input = asGenerator ? stream() : source;
    const output = checkAllWith(input, (purl, version) => {
      seen += 1;
      const res = check(purl, version);
      if (seen === uniqueCount) {
        globalThis.gc();
        peakBytes = process.memoryUsage().heapUsed - afterInput;
      }
      return res;
    });

    globalThis.gc();
    globalThis.gc();
    const retainedBytes = process.memoryUsage().heapUsed - afterInput;

    // Keep source and output alive past the final heap measurement.
    if (source.length !== COUNT || output.summary.total !== COUNT) {
      throw new Error("unexpected batch size");
    }

    process.stdout.write(JSON.stringify({ inputBytes, peakBytes, retainedBytes, total: output.summary.total }));
  `;

  const stdout = execFileSync(process.execPath, ["--expose-gc", "--input-type=module", "-e", script], {
    encoding: "utf8",
  });
  return JSON.parse(stdout) as MemoryReport;
}

test("checkAll keeps memory within 2x of the input size for 100,000 items", () => {
  const uniqueReport = measureBatchInSubprocess(100_000, false);
  assert.equal(uniqueReport.total, 100_000);
  assert.ok(uniqueReport.inputBytes > 1_000_000, `unexpectedly small inputBytes=${uniqueReport.inputBytes}`);
  assert.ok(
    uniqueReport.peakBytes <= uniqueReport.inputBytes * 2,
    `peakBytes=${uniqueReport.peakBytes} exceeded 2x inputBytes=${uniqueReport.inputBytes}`,
  );
  assert.ok(
    uniqueReport.retainedBytes <= uniqueReport.inputBytes * 2,
    `retainedBytes=${uniqueReport.retainedBytes} exceeded 2x inputBytes=${uniqueReport.inputBytes}`,
  );

  const generatorReport = measureBatchInSubprocess(2_000, true);
  assert.equal(generatorReport.total, 100_000);
  assert.ok(
    generatorReport.peakBytes <= generatorReport.inputBytes * 2,
    `generator peakBytes=${generatorReport.peakBytes} exceeded 2x inputBytes=${generatorReport.inputBytes}`,
  );
  assert.ok(
    generatorReport.retainedBytes <= generatorReport.inputBytes * 2,
    `generator retainedBytes=${generatorReport.retainedBytes} exceeded 2x inputBytes=${generatorReport.inputBytes}`,
  );
});
