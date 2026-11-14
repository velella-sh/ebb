import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { test } from "node:test";
import esbuild from "esbuild";
import { type BrowserType, chromium, firefox, webkit } from "playwright";

function isBrowserAvailable(type: BrowserType): boolean {
  try {
    const execPath = type.executablePath();
    return Boolean(execPath && fs.existsSync(execPath));
  } catch {
    return false;
  }
}

// Bundle ebb/browser for client execution
async function buildBrowserBundle(): Promise<string> {
  const result = await esbuild.build({
    entryPoints: ["src/browser.ts"],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
    minify: false,
  });
  return result.outputFiles[0]!.text;
}

test("browser: runs in Chromium, Firefox, and WebKit with identical verdicts", async (t) => {
  const bundleCode = await buildBrowserBundle();

  // Mock static API response for fetch loader test
  const mockNpmEcosystem = {
    schemaVersion: "ebb.registry.v2",
    ecosystem: "npm",
    rules: [
      {
        id: "npm.package.request.deprecated",
        ecosystem: "npm",
        purl: "pkg:npm/request",
        vers: "vers:npm/*",
        event: "deprecated",
        title: "request is deprecated",
        summary: "The package is fully deprecated.",
        severity: "high",
        replacement: "Native fetch or a maintained HTTP client",
        deadline: "2020-02-11",
        sources: [{ title: "notice", url: "https://www.npmjs.com/package/request", accessedAt: "2026-10-13" }],
        provenance: { observedAt: "2026-10-13", reviewedAt: "2026-10-13", reviewer: "test" },
      },
    ],
  };

  // Start local HTTP server to serve the bundle and static API mock
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.url === "/bundle.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(bundleCode);
      return;
    }

    if (req.url === "/api/v1/ecosystems/npm.json" || req.url === "/api/v1/npm.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockNpmEcosystem));
      return;
    }

    if (req.url === "/api/v1/ecosystems/osv.json" || req.url === "/api/v1/osv.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ schemaVersion: "ebb.registry.v2", ecosystem: "osv", rules: [] }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;
  const bundleUrl = `http://127.0.0.1:${port}/bundle.js`;
  const apiUrl = `http://127.0.0.1:${port}/api/v1`;

  const browsers = [
    { name: "Chromium", type: chromium },
    { name: "Firefox", type: firefox },
    { name: "WebKit", type: webkit },
  ];

  const availableBrowsers = browsers.filter((b) => isBrowserAvailable(b.type));
  if (availableBrowsers.length === 0) {
    t.skip("No Playwright browser binaries installed");
    return;
  }

  try {
    for (const { name, type } of browsers) {
      await t.test(`runs test suite in ${name}`, { skip: !isBrowserAvailable(type) }, async () => {
        const browser = await type.launch({ headless: true });
        try {
          const context = await browser.newContext();
          const page = await context.newPage();

          // Set up HTML page with bundle loaded as ES module
          await page.setContent(`
            <!DOCTYPE html>
            <html>
              <head><meta charset="utf-8"></head>
              <body>
                <div id="output">ready</div>
                <script type="module">
                  import * as ebb from "${bundleUrl}";
                  window.__ebb = ebb;
                  document.getElementById("output").textContent = "loaded";
                </script>
              </body>
            </html>
          `);

          // Wait until module loads
          await page.waitForFunction(() => document.getElementById("output")?.textContent === "loaded");

          // 1. check() on deprecated npm package
          const requestResult = await page.evaluate(() => {
            const { check } = (window as any).__ebb;
            return check("pkg:npm/request", "2.88.2");
          });
          assert.equal(requestResult.status, "deprecated");
          assert.ok(requestResult.matches.length >= 1);
          assert.equal(requestResult.matches[0].event, "deprecated");
          assert.equal(requestResult.matches[0].replacement, "Native fetch or a maintained HTTP client");

          // 2. check() on bare product name
          const nodeResult = await page.evaluate(() => {
            const { check } = (window as any).__ebb;
            return check("node", "18.20.4");
          });
          assert.equal(nodeResult.status, "end-of-life");
          assert.equal(nodeResult.matches[0].event, "end-of-life");

          // 3. check() on ok package version
          const okResult = await page.evaluate(() => {
            const { check } = (window as any).__ebb;
            return check("pkg:npm/chalk", "5.3.0");
          });
          assert.equal(okResult.status, "ok");

          // 4. replacementFor()
          const replacement = await page.evaluate(() => {
            const { replacementFor } = (window as any).__ebb;
            return replacementFor("pkg:npm/node-sass", "9.0.0");
          });
          assert.equal(replacement, "pkg:npm/sass");

          // 5. rulesFor()
          const rules = await page.evaluate(() => {
            const { rulesFor } = (window as any).__ebb;
            return rulesFor("pkg:npm/request");
          });
          assert.ok(Array.isArray(rules));
          assert.ok(rules.length > 0);
          assert.equal(rules[0].event, "deprecated");

          // 6. checkAll() batch evaluation
          const allBatch = await page.evaluate(() => {
            const { checkAll } = (window as any).__ebb;
            return checkAll([
              { purl: "pkg:npm/request", version: "2.88.2" },
              { purl: "pkg:npm/left-pad", version: "1.3.0" },
            ]);
          });
          assert.equal(allBatch.summary.total, 2);
          assert.equal(allBatch.summary.byStatus.deprecated, 2);

          // 7. createEbb scoped instance
          const scopedCheck = await page.evaluate(() => {
            const { createEbb } = (window as any).__ebb;
            const instance = createEbb({ ecosystems: ["npm"] });
            return instance.check("pkg:npm/request", "2.88.2");
          });
          assert.equal(scopedCheck.status, "deprecated");

          // 8. createFetchLoader static API in browser
          const fetchLoaderResult = await page.evaluate(async (endpoint) => {
            const { check, createFetchLoader, setDataLoader, preload } = (window as any).__ebb;
            const fetchLoader = createFetchLoader({ baseUrl: endpoint });
            setDataLoader(fetchLoader);
            await preload(["npm", "osv"]);
            return check("pkg:npm/request", "2.88.2");
          }, apiUrl);
          assert.equal(fetchLoaderResult.status, "deprecated");
          assert.equal(fetchLoaderResult.matches[0].event, "deprecated");
        } finally {
          await browser.close();
        }
      });
    }
  } finally {
    server.close();
  }
});
