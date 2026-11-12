import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import esbuild from "esbuild";
import { Miniflare } from "miniflare";

// Cloudflare Workers free plan limit: 1 MB compressed / 3 MB uncompressed
const CF_FREE_LIMIT_COMPRESSED_BYTES = 1_048_576;
const CF_FREE_LIMIT_RAW_BYTES = 3_145_728;

test("edge: measures Worker bundle size against Cloudflare free plan budget", async () => {
  const workerEntry = `
    import { check, checkAll, createEbb, preload, replacementFor, rulesFor } from "./dist/src/browser.js";

    export default {
      async fetch(request) {
        const url = new URL(request.url);
        const purl = url.searchParams.get("purl") || "pkg:npm/request";
        const version = url.searchParams.get("version") || "2.88.2";
        const result = check(purl, version);
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json" },
        });
      },
    };
  `;

  const buildResult = await esbuild.build({
    stdin: {
      contents: workerEntry,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    write: false,
    conditions: ["workerd", "worker", "edge-light", "browser"],
  });

  const bundledText = buildResult.outputFiles[0]!.text;
  const rawBytes = Buffer.byteLength(bundledText, "utf8");
  const gzipBytes = gzipSync(bundledText).length;

  // Assert worker is well under free plan limits
  assert.ok(
    rawBytes < CF_FREE_LIMIT_RAW_BYTES,
    `Worker raw size ${rawBytes} exceeds free limit ${CF_FREE_LIMIT_RAW_BYTES}`,
  );
  assert.ok(
    gzipBytes < CF_FREE_LIMIT_COMPRESSED_BYTES,
    `Worker compressed size ${gzipBytes} exceeds free limit ${CF_FREE_LIMIT_COMPRESSED_BYTES}`,
  );

  // In fact, our entire 25-ecosystem bundle is under 200 KB compressed
  assert.ok(gzipBytes < 250_000, `Worker compressed size ${gzipBytes} expected < 250 KB`);
});

test("edge: runs under workerd (Cloudflare Workers runtime)", async () => {
  const workerEntry = `
    import {
      check,
      checkAll,
      createEbb,
      preload,
      replacementFor,
      rulesFor,
      createFetchLoader,
      setDataLoader,
    } from "./dist/src/browser.js";

    export default {
      async fetch(request) {
        const url = new URL(request.url);
        const action = url.pathname;

        if (action === "/check") {
          const purl = url.searchParams.get("purl") || "";
          const version = url.searchParams.get("version") || "";
          return Response.json(check(purl, version));
        }

        if (action === "/check-all") {
          const body = await request.json();
          return Response.json(checkAll(body));
        }

        if (action === "/replacement") {
          const purl = url.searchParams.get("purl") || "";
          const version = url.searchParams.get("version") || "";
          return Response.json({ replacement: replacementFor(purl, version) });
        }

        if (action === "/rules") {
          const purl = url.searchParams.get("purl") || "";
          return Response.json(rulesFor(purl));
        }

        if (action === "/scoped") {
          const instance = createEbb({ ecosystems: ["npm"] });
          return Response.json(instance.check("pkg:npm/request", "2.88.2"));
        }

        return new Response("Not Found", { status: 404 });
      },
    };
  `;

  const buildResult = await esbuild.build({
    stdin: {
      contents: workerEntry,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
    conditions: ["workerd", "worker", "edge-light", "browser"],
  });

  const mf = new Miniflare({
    modules: true,
    script: buildResult.outputFiles[0]!.text,
  });

  try {
    // 1. check() on deprecated package
    const checkRes = await mf.dispatchFetch("http://localhost/check?purl=pkg:npm/request&version=2.88.2");
    assert.equal(checkRes.status, 200);
    const checkData = (await checkRes.json()) as any;
    assert.equal(checkData.status, "deprecated");
    assert.equal(checkData.matches[0].event, "deprecated");

    // 2. check() on bare name
    const bareRes = await mf.dispatchFetch("http://localhost/check?purl=node&version=18.20.4");
    assert.equal(bareRes.status, 200);
    const bareData = (await bareRes.json()) as any;
    assert.equal(bareData.status, "end-of-life");

    // 3. checkAll() batch
    const batchRes = await mf.dispatchFetch("http://localhost/check-all", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        { purl: "pkg:npm/request", version: "2.88.2" },
        { purl: "pkg:npm/left-pad", version: "1.3.0" },
      ]),
    });
    assert.equal(batchRes.status, 200);
    const batchData = (await batchRes.json()) as any;
    assert.equal(batchData.summary.total, 2);
    assert.equal(batchData.summary.byStatus.deprecated, 2);

    // 4. replacementFor()
    const replRes = await mf.dispatchFetch("http://localhost/replacement?purl=pkg:npm/node-sass&version=9.0.0");
    assert.equal(replRes.status, 200);
    const replData = (await replRes.json()) as any;
    assert.equal(replData.replacement, "pkg:npm/sass");

    // 5. rulesFor()
    const rulesRes = await mf.dispatchFetch("http://localhost/rules?purl=pkg:npm/request");
    assert.equal(rulesRes.status, 200);
    const rulesData = (await rulesRes.json()) as any;
    assert.ok(Array.isArray(rulesData));
    assert.ok(rulesData.length > 0);

    // 6. Scoped createEbb instance
    const scopedRes = await mf.dispatchFetch("http://localhost/scoped");
    assert.equal(scopedRes.status, 200);
    const scopedData = (await scopedRes.json()) as any;
    assert.equal(scopedData.status, "deprecated");
  } finally {
    await mf.dispose();
  }
});
