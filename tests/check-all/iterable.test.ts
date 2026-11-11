import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../../src/check.js";
import { type CheckAllItem, checkAll, checkAllWith } from "../../src/check-all.js";

test("checkAll accepts a generator in a single pass with the same output as an array", () => {
  const source: readonly CheckAllItem[] = [
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/express", version: "4.21.0" },
    { purl: "pkg:", version: "1.0.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
  ];

  function* generateItems(): Generator<CheckAllItem> {
    yield* source;
  }

  let calls = 0;
  const fromGenerator = checkAllWith(generateItems(), (purl, version) => {
    calls += 1;
    return check(purl, version);
  });
  const fromArray = checkAll(source);

  assert.equal(calls, 3);
  assert.deepEqual(fromGenerator, fromArray);
});

test("checkAll accepts a Set and Map.values() iterable", () => {
  const items = new Set<CheckAllItem>([
    { purl: "pkg:npm/node-sass", version: "9.0.0" },
    { purl: "pkg:generic/nodejs", version: "22.12.0" },
    { purl: "pkg:npm/express", version: "4.21.0" },
  ]);

  const fromSet = checkAll(items);
  const fromArray = checkAll([...items]);

  assert.deepEqual(fromSet, fromArray);
  assert.equal(fromSet.summary.total, 3);
});

test("checkAll consumes custom iterables once and handles an empty generator", () => {
  let iteratorCalls = 0;
  const sample: readonly CheckAllItem[] = [
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/express", version: "4.21.0" },
  ];
  const singlePassIterable: Iterable<CheckAllItem> = {
    [Symbol.iterator]() {
      iteratorCalls += 1;
      let cursor = 0;
      return {
        next(): IteratorResult<CheckAllItem> {
          if (cursor >= sample.length) return { done: true, value: undefined };
          const value = sample[cursor]!;
          cursor += 1;
          return { done: false, value };
        },
      };
    },
  };

  const singlePass = checkAll(singlePassIterable);
  assert.equal(iteratorCalls, 1);
  assert.deepEqual(singlePass, checkAll(sample));

  function* empty(): Generator<CheckAllItem> {}
  assert.deepEqual(checkAll(empty()), checkAll([]));
});
