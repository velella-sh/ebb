import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import { fetchComponent, fetchMeta, fetchRule, fetchSingleRule, fetchUpcoming, purlToApiPath } from "../src/api.js";
import { VERSION } from "../src/version.js";
import { generateStaticApi } from "../tools/static-api/generate.js";
import { runSmokeTest } from "../tools/static-api/smoke.js";

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

async function getAllFiles(dir: string, base = ""): Promise<string[]> {
  const entries = await readdir(join(dir, base), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(dir, rel)));
    } else {
      files.push(rel);
    }
  }
  return files.sort();
}

test("purlToApiPath maps package URLs to correct static API relative paths", () => {
  assert.equal(purlToApiPath("pkg:npm/request"), "npm/request.json");
  assert.equal(purlToApiPath("pkg:npm/request@2.88.2"), "npm/request.json");
  assert.equal(purlToApiPath("pkg:npm/%40angular/core@12.0.0"), "npm/@angular/core.json");
  assert.equal(purlToApiPath("pkg:npm/@angular/core@12.0.0"), "npm/@angular/core.json");
  assert.equal(purlToApiPath("pkg:pypi/django@4.0"), "pypi/django.json");
  assert.equal(purlToApiPath("pkg:github-actions/actions/checkout@v2"), "github-actions/actions/checkout.json");
  assert.equal(purlToApiPath("pkg:docker/library/node"), "docker/library/node.json");
  assert.equal(purlToApiPath("pkg:generic/node"), "generic/node.json");
});

test("static API generation produces valid files matching JSON schema and size budgets", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "ebb-static-api-test-"));

  try {
    const result = await generateStaticApi({
      outDir: tempDir,
      createdAt: "2026-11-12T00:00:00.000Z",
    });

    assert.ok(result.componentCount > 400, `Expected > 400 components, got ${result.componentCount}`);
    assert.ok(result.ecosystemCount >= 25, `Expected >= 25 ecosystems, got ${result.ecosystemCount}`);
    assert.ok(result.ruleCount > 700, `Expected > 700 rules, got ${result.ruleCount}`);
    assert.ok(result.allGzipBytes > 0, "all.json gzip size should be computed");

    // Size budgets: index gzip < 50KB, search gzip < 25KB
    assert.ok(
      result.indexGzipBytes < 50 * 1024,
      `index.json gzip size (${result.indexGzipBytes}) exceeded 50KB budget`,
    );
    assert.ok(
      result.searchGzipBytes < 25 * 1024,
      `search-index.json gzip size (${result.searchGzipBytes}) exceeded 25KB budget`,
    );

    const tablesDir = "registry/tables";
    const compatTables = (await readdir(tablesDir)).filter((name) => name.endsWith(".compat.json"));
    assert.ok(compatTables.length >= 2);
    for (const name of compatTables) {
      assert.deepEqual(
        await readFile(join(tempDir, "compat", name.replace(/\.compat\.json$/, ".json"))),
        await readFile(join(tablesDir, name)),
      );
    }
    assert.deepEqual(
      await readFile(join(tempDir, "schemas", "compat.v1.schema.json")),
      await readFile("schemas/compat.v1.schema.json"),
    );

    // Verify Ajv schema validation
    const ajv = new Ajv2020({ allErrors: true });
    const schema = JSON.parse(await readFile("schemas/static-api.v1.schema.json", "utf8")) as object;
    const regSchema = JSON.parse(await readFile("schemas/registry.v2.schema.json", "utf8")) as object;
    ajv.addSchema(regSchema, "registry.v2.schema.json");
    const validate = ajv.compile(schema);

    // Validate component file
    const requestJsonRaw = await readFile(join(tempDir, "npm/request.json"), "utf8");
    const requestDoc = JSON.parse(requestJsonRaw);
    assert.equal(validate(requestDoc), true, `npm/request.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.equal(requestDoc.purl, "pkg:npm/request");
    assert.equal(requestDoc.schemaVersion, "ebb.api.v1");
    assert.equal(requestDoc.version, VERSION);
    assert.equal(requestDoc.generatedAt, "2026-11-12T00:00:00.000Z");
    assert.equal(requestDoc.$schema, "https://velella.sh/ebb/api/v1/schemas/static-api.v1.schema.json");
    assert.equal(requestDoc.hint, undefined);
    assert.ok(requestDoc.rules.length > 0);
    assert.equal(requestDoc.rules[0].confidence, "confirmed");
    assert.equal(requestDoc.rules[0].url, "https://velella.sh/ebb/api/v1/rules/npm.package.request.deprecated.json");
    assert.ok(Array.isArray(requestDoc.replacements));
    assert.equal(requestDoc.replacements[0].purl, "pkg:npm/undici");
    assert.equal(requestDoc.replacements[0].name, "undici");
    assert.equal(requestDoc.replacements[0].kind, "alternative");
    assert.equal(requestDoc.calendar, undefined);
    await assert.rejects(readFile(join(tempDir, "calendar/npm/request.ics"), "utf8"));

    const nodeDoc = JSON.parse(await readFile(join(tempDir, "generic/nodejs.json"), "utf8"));
    assert.equal(nodeDoc.calendar, "https://velella.sh/ebb/api/v1/calendar/generic/nodejs.ics");
    assert.equal(validate(nodeDoc), true, `generic/nodejs.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.equal(nodeDoc.versions.asOf, "2026-11-12");
    assert.equal(nodeDoc.versions.complete, false);
    assert.equal(nodeDoc.versions.recommendation, null);
    assert.match(nodeDoc.versions.reason, /22\.x.*within 180 days/);
    assert.ok(nodeDoc.rules.some((rule: { id: string }) => rule.id === "nodejs.runtime.eol-26"));
    assert.ok(!nodeDoc.versions.lines.some((line: { id: string }) => line.id === "26.x"));
    assert.ok(nodeDoc.versions.lines.some((line: { id: string }) => line.id === "22.x"));
    assert.ok(JSON.stringify(nodeDoc.versions).length < 4000);
    assert.equal(requestDoc.versions.lines[0].id, "*");
    assert.equal(requestDoc.versions.lines[0].status, "ended");
    assert.equal(requestDoc.versions.recommendation, null);
    const nodeFeed = await readFile(join(tempDir, "calendar/generic/nodejs.ics"), "utf8");
    assert.match(nodeFeed, /UID:nodejs\.runtime\.eol-22@velella\.sh/);
    const allFeed = await readFile(join(tempDir, "calendar/all.ics"), "utf8");
    assert.match(allFeed, /UID:nodejs\.runtime\.eol-22@velella\.sh/);
    assert.doesNotMatch(allFeed, /npm\.package\.request\.deprecated/);
    assert.match(await readFile(join(tempDir, "calendar/nodejs.ics"), "utf8"), /BEGIN:VCALENDAR/);
    assert.match(await readFile(join(tempDir, "calendar/npm.ics"), "utf8"), /BEGIN:VCALENDAR/);

    // Validate ecosystem file
    const npmJsonRaw = await readFile(join(tempDir, "npm.json"), "utf8");
    const npmDoc = JSON.parse(npmJsonRaw);
    assert.equal(validate(npmDoc), true, `npm.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.equal(npmDoc.ecosystem, "npm");
    assert.ok(npmDoc.rulesCount > 50);

    // Validate ecosystems.json
    const ecosystemsJsonRaw = await readFile(join(tempDir, "ecosystems.json"), "utf8");
    const ecosystemsDoc = JSON.parse(ecosystemsJsonRaw);
    assert.equal(
      validate(ecosystemsDoc),
      true,
      `ecosystems.json validation failed: ${JSON.stringify(validate.errors)}`,
    );
    assert.ok(ecosystemsDoc.ecosystemsCount >= 25);

    // Validate all.json
    const allJsonRaw = await readFile(join(tempDir, "all.json"), "utf8");
    const allDoc = JSON.parse(allJsonRaw);
    assert.equal(validate(allDoc), true, `all.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.equal(allDoc.rulesCount, result.ruleCount);
    assert.equal(allDoc.gzipBytes, result.allGzipBytes);
    assert.ok(
      allDoc.rules.every((r: { confidence: string }) => ["confirmed", "likely", "tentative"].includes(r.confidence)),
      "Every rule in all.json must have a valid confidence level",
    );

    // Validate index.json
    const indexJsonRaw = await readFile(join(tempDir, "index.json"), "utf8");
    const indexDoc = JSON.parse(indexJsonRaw);
    assert.equal(validate(indexDoc), true, `index.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.ok(indexDoc.components["pkg:npm/request"]);
    const reqIndex = indexDoc.components["pkg:npm/request"];
    assert.equal(reqIndex.path, "npm/request.json");
    assert.equal(reqIndex.url, "https://velella.sh/ebb/api/v1/npm/request.json");
    assert.equal(reqIndex.sha256, sha256Hex(requestJsonRaw));
    assert.equal(reqIndex.etag, `"${reqIndex.sha256.slice(0, 16)}"`);
    assert.equal(reqIndex.bytes, Buffer.byteLength(requestJsonRaw, "utf8"));

    // Validate upcoming.json
    const upcomingJsonRaw = await readFile(join(tempDir, "upcoming.json"), "utf8");
    const upcomingDoc = JSON.parse(upcomingJsonRaw);
    assert.equal(validate(upcomingDoc), true, `upcoming.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.ok(upcomingDoc.count > 0);
    // Verify ascending order by deadline
    for (let i = 1; i < upcomingDoc.upcoming.length; i++) {
      const prev = upcomingDoc.upcoming[i - 1].deadline ?? "9999-99-99";
      const curr = upcomingDoc.upcoming[i].deadline ?? "9999-99-99";
      assert.ok(prev <= curr, `upcoming.json not sorted: ${prev} > ${curr}`);
    }

    // Validate recent.json
    const recentJsonRaw = await readFile(join(tempDir, "recent.json"), "utf8");
    const recentDoc = JSON.parse(recentJsonRaw);
    assert.equal(validate(recentDoc), true, `recent.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.ok(recentDoc.count > 0);
    // Verify descending order by review date
    for (let i = 1; i < recentDoc.recent.length; i++) {
      const prev = recentDoc.recent[i - 1].reviewedAt ?? recentDoc.recent[i - 1].observedAt ?? "0000-00-00";
      const curr = recentDoc.recent[i].reviewedAt ?? recentDoc.recent[i].observedAt ?? "0000-00-00";
      assert.ok(prev >= curr, `recent.json not sorted descending: ${prev} < ${curr}`);
    }

    // Validate search-index.json
    const searchJsonRaw = await readFile(join(tempDir, "search-index.json"), "utf8");
    const searchDoc = JSON.parse(searchJsonRaw);
    assert.equal(validate(searchDoc), true, `search-index.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.ok(searchDoc.items.length > 400);
    assert.ok(searchDoc.prefixes["req"]);
    const reqIndices = searchDoc.prefixes["req"] as number[];
    const matchedNames = reqIndices.map((i: number) => searchDoc.items[i].name);
    assert.ok(matchedNames.includes("request"), "Prefix 'req' should match 'request'");

    // Validate meta.json (Sub-issue 2 / #477)
    const metaRaw = await readFile(join(tempDir, "meta.json"), "utf8");
    const metaDoc = JSON.parse(metaRaw);
    assert.equal(validate(metaDoc), true, `meta.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.equal(metaDoc.schemaVersion, "ebb.api.v1");
    assert.equal(metaDoc.version, VERSION);
    assert.match(metaDoc.dataVersion, /^\d{4}\.\d{2}\.\d{2}$/);
    assert.equal(metaDoc.rulesCount, result.ruleCount);
    assert.equal(metaDoc.componentsCount, result.componentCount);
    assert.equal(metaDoc.ecosystemsCount, result.ecosystemCount);
    assert.equal(metaDoc.schemaVersions.api, "ebb.api.v1");
    assert.equal(metaDoc.schemaVersions.rule, "ebb.rule.v2");
    assert.equal(metaDoc.schemaVersions.result, 1);
    assert.equal(metaDoc.generatedAt, undefined, "meta.json must not include a build timestamp");

    // Validate releases.json (Sub-issue 5 / #520)
    const releasesRaw = await readFile(join(tempDir, "releases.json"), "utf8");
    const releasesDoc = JSON.parse(releasesRaw);
    assert.equal(validate(releasesDoc), true, `releases.json validation failed: ${JSON.stringify(validate.errors)}`);
    assert.equal(releasesDoc.schemaVersion, "ebb.api.v1");
    assert.equal(typeof releasesDoc.count, "number");
    assert.ok(Array.isArray(releasesDoc.releases));

    // Validate single rule file in /rules/<rule-id>.json (Sub-issue 3 / #478)
    const ruleFileRaw = await readFile(join(tempDir, "rules/npm.package.request.deprecated.json"), "utf8");
    const ruleDoc = JSON.parse(ruleFileRaw);
    assert.equal(validate(ruleDoc), true, `rule file validation failed: ${JSON.stringify(validate.errors)}`);
    assert.equal(ruleDoc.schemaVersion, "ebb.api.v1");
    assert.equal(ruleDoc.rule.id, "npm.package.request.deprecated");
    assert.ok(Array.isArray(ruleDoc.rule.sources));
    assert.ok(ruleDoc.rule.provenance);
    assert.equal(ruleDoc.rule.url, "https://velella.sh/ebb/api/v1/rules/npm.package.request.deprecated.json");

    // Validate openapi.json (Sub-issue 5 / #480)
    const openApiRaw = await readFile(join(tempDir, "openapi.json"), "utf8");
    const openApiDoc = JSON.parse(openApiRaw);
    assert.equal(openApiDoc.openapi, "3.1.0");
    assert.ok(openApiDoc.paths["/meta.json"]);
    assert.ok(openApiDoc.paths["/releases.json"]);
    assert.ok(openApiDoc.paths["/rules/{rule-id}.json"]);
    assert.ok(openApiDoc.paths["/{type}/{name}.json"]);

    // Validate 404.json (Sub-issue 6 / #481)
    const notFoundRaw = await readFile(join(tempDir, "404.json"), "utf8");
    const notFoundDoc = JSON.parse(notFoundRaw);
    assert.equal(notFoundDoc.error, "Not Found");
    assert.ok(notFoundDoc.message.includes("404 does not mean supported"));

    // Validate published JSON Schemas (Sub-issue 4 / #479)
    assert.ok((await readFile(join(tempDir, "schemas/static-api.v1.schema.json"), "utf8")).length > 0);
    assert.ok((await readFile(join(tempDir, "schemas/rule.v2.schema.json"), "utf8")).length > 0);
    assert.ok((await readFile(join(tempDir, "schemas/registry.v2.schema.json"), "utf8")).length > 0);
    assert.ok((await readFile(join(tempDir, "schemas/result.v1.schema.json"), "utf8")).length > 0);

    // Validate sources/<rule-id>.json
    const ruleSourcesRaw = await readFile(join(tempDir, "sources/npm.package.request.deprecated.json"), "utf8");
    const ruleSourcesDoc = JSON.parse(ruleSourcesRaw);
    assert.equal(ruleSourcesDoc.ruleId, "npm.package.request.deprecated");
    assert.equal(ruleSourcesDoc.schemaVersion, "ebb.api.v1");
    assert.ok(Array.isArray(ruleSourcesDoc.sources));
    assert.ok(ruleSourcesDoc.sources.length > 0);

    // Verify percent-encoded alias for scoped packages (e.g. %40types)
    const encodedCheck = await readFile(join(tempDir, "npm/@types/form-data.json"), "utf8");
    assert.ok(encodedCheck.length > 0);
    const aliasCheck = await readFile(join(tempDir, "npm/%40types/form-data.json"), "utf8");
    assert.equal(aliasCheck, encodedCheck);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("static API generation is deterministic across two runs on identical data", async () => {
  const dir1 = await mkdtemp(join(tmpdir(), "ebb-determ-1-"));
  const dir2 = await mkdtemp(join(tmpdir(), "ebb-determ-2-"));

  try {
    // Neither run passes createdAt, so both derive dates entirely from the data
    await generateStaticApi({ outDir: dir1 });
    await generateStaticApi({ outDir: dir2 });

    const files1 = await getAllFiles(dir1);
    const files2 = await getAllFiles(dir2);

    assert.deepEqual(files1, files2, "File lists between two runs must be identical");
    assert.ok(files1.length > 500, `Expected > 500 files, got ${files1.length}`);

    // Check byte-for-byte identity of every single generated file
    for (const file of files1) {
      const buf1 = await readFile(join(dir1, file));
      const buf2 = await readFile(join(dir2, file));
      assert.deepEqual(buf1, buf2, `File ${file} differed across deterministic runs!`);
    }
  } finally {
    await rm(dir1, { recursive: true, force: true });
    await rm(dir2, { recursive: true, force: true });
  }
});

test("docs table and OpenAPI description list the exact same endpoints", async () => {
  const docsContent = await readFile("docs/static-api.md", "utf8");

  // Extract endpoints from the URL Layout markdown table in docs/static-api.md
  const docEndpoints: string[] = [];
  const lines = docsContent.split("\n");
  let inTable = false;
  for (const line of lines) {
    if (line.includes("| Endpoint | Description | Example |")) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (!line.trim().startsWith("|")) break;
      const match = line.match(/^\|\s*`([^`]+)`/);
      if (match && match[1] && !match[1].includes(":---")) {
        // Normalize <param> to {param} for OpenAPI alignment
        const normalized = match[1].replace(/<([^>]+)>/g, "{$1}");
        docEndpoints.push(normalized);
      }
    }
  }

  // Import ENDPOINTS directly from openapi.ts
  const { ENDPOINTS } = await import("../tools/static-api/openapi.js");
  const openApiEndpoints = ENDPOINTS.map((e) => e.path);

  assert.ok(docEndpoints.length >= 15, `Expected >= 15 endpoints in docs, found ${docEndpoints.length}`);
  assert.deepEqual(
    docEndpoints.sort(),
    openApiEndpoints.sort(),
    "Endpoints in docs/static-api.md must match OpenAPI ENDPOINTS 1:1",
  );
});

test("search index splits by first letter when exceeding size budget", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "ebb-split-search-"));

  try {
    // Pass a very low search budget (500 bytes) to trigger splitting
    await generateStaticApi({
      outDir: tempDir,
      searchBudget: 500,
    });

    const indexContent = await readFile(join(tempDir, "search-index.json"), "utf8");
    const indexDoc = JSON.parse(indexContent);

    assert.equal(indexDoc.split, true, "search-index.json must mark split: true");
    assert.ok(indexDoc.partitions, "search-index.json must contain partitions map");
    assert.ok(indexDoc.partitions["r"], "Partition for 'r' should exist");

    // Check individual partitioned file
    const rPartitionRaw = await readFile(join(tempDir, "search-index/r.json"), "utf8");
    const rDoc = JSON.parse(rPartitionRaw);
    assert.equal(rDoc.letter, "r");
    assert.ok(rDoc.items.some((i: { name: string }) => i.name.toLowerCase().startsWith("r")));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("fetchComponent and fetchRule query static API correctly with mock fetch", async () => {
  const mockDb: Record<string, string> = {
    "https://velella.sh/ebb/api/v1/npm/request.json": JSON.stringify({
      schemaVersion: "ebb.api.v1",
      version: "0.1.1",
      generatedAt: "2026-11-12T00:00:00.000Z",
      purl: "pkg:npm/request",
      type: "npm",
      name: "request",
      ecosystems: ["npm"],
      rules: [
        {
          id: "npm.package.request.deprecated",
          ecosystem: "npm",
          purl: "pkg:npm/request",
          vers: "vers:npm/*",
          event: "deprecated",
          title: "request is deprecated",
          severity: "high",
          replacement: "Native fetch or a maintained HTTP client",
          deadline: "2020-02-11",
        },
      ],
      hint: "legacy hint from an older file",
    }),
  };

  const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (mockDb[url]) {
      return {
        status: 200,
        ok: true,
        json: async () => JSON.parse(mockDb[url]!),
      } as unknown as Response;
    }
    return {
      status: 404,
      ok: false,
      statusText: "Not Found",
    } as unknown as Response;
  };

  // Test fetchComponent
  const comp = await fetchComponent("pkg:npm/request", { fetch: mockFetch });
  assert.ok(comp);
  assert.equal(comp?.name, "request");
  assert.equal(comp?.rules.length, 1);
  assert.equal(comp?.hint, "legacy hint from an older file");

  // Test fetchRule with matching version
  const rules = await fetchRule("pkg:npm/request@2.88.2", { fetch: mockFetch });
  assert.ok(rules);
  assert.equal(rules?.length, 1);
  assert.equal(rules?.[0]?.id, "npm.package.request.deprecated");

  // Test fetchRule without version returns all rules
  const allRules = await fetchRule("pkg:npm/request", { fetch: mockFetch });
  assert.ok(allRules);
  assert.equal(allRules?.length, 1);

  // Test fetchComponent not found returns null (typed not found)
  const notFound = await fetchComponent("pkg:npm/unknown-package", { fetch: mockFetch });
  assert.equal(notFound, null);

  // Test fetchRule not found returns null
  const notFoundRule = await fetchRule("pkg:npm/unknown-package", { fetch: mockFetch });
  assert.equal(notFoundRule, null);

  // Test fetchRule with asOf filtering
  const futureAsOf = await fetchRule("pkg:npm/request@2.88.2", {
    fetch: mockFetch,
    asOf: "2025-01-01",
  });
  assert.equal(futureAsOf?.length, 1);

  const pastAsOf = await fetchRule("pkg:npm/request@2.88.2", {
    fetch: mockFetch,
    asOf: "2019-01-01",
  });
  assert.equal(pastAsOf?.length, 0);

  // Test network error throws informative error
  const failingFetch: typeof fetch = async () => {
    return {
      status: 500,
      ok: false,
      statusText: "Internal Server Error",
    } as unknown as Response;
  };
  await assert.rejects(
    () => fetchComponent("pkg:npm/request", { fetch: failingFetch }),
    /Failed to fetch static API component at .* HTTP 500 Internal Server Error/,
  );
});

test("bundled client extensions: fetchMeta, fetchUpcoming, fetchSingleRule, timeout, retry, and 404", async () => {
  const mockDb: Record<string, string> = {
    "https://velella.sh/ebb/api/v1/meta.json": JSON.stringify({
      schemaVersion: "ebb.api.v1",
      version: "0.3.0",
      dataVersion: "2026.11.12",
      rulesCount: 830,
      componentsCount: 420,
      ecosystemsCount: 26,
      schemaVersions: { api: "ebb.api.v1", rule: "ebb.rule.v2", result: 1 },
    }),
    "https://velella.sh/ebb/api/v1/upcoming.json": JSON.stringify({
      schemaVersion: "ebb.api.v1",
      version: "0.3.0",
      generatedAt: "2026-11-12T00:00:00.000Z",
      count: 1,
      upcoming: [
        {
          ruleId: "nodejs.runtime.eol-22",
          purl: "pkg:generic/nodejs",
          ecosystem: "generic",
          event: "end-of-life",
          title: "Node.js 22 reached end of life",
          deadline: "2027-04-30",
          path: "generic/nodejs.json",
        },
      ],
    }),
    "https://velella.sh/ebb/api/v1/rules/npm.package.request.deprecated.json": JSON.stringify({
      schemaVersion: "ebb.api.v1",
      version: "0.3.0",
      generatedAt: "2026-11-12T00:00:00.000Z",
      rule: {
        id: "npm.package.request.deprecated",
        ecosystem: "npm",
        purl: "pkg:npm/request",
        vers: "vers:npm/*",
        event: "deprecated",
        title: "request is deprecated",
        severity: "high",
        sources: [],
        provenance: { method: "manual", reviewer: "armin" },
      },
    }),
    "https://velella.sh/ebb/api/v1/rules/custom%2Fspecial%40name.json": JSON.stringify({
      schemaVersion: "ebb.api.v1",
      version: "0.3.0",
      generatedAt: "2026-11-12T00:00:00.000Z",
      rule: {
        id: "custom/special@name",
        ecosystem: "npm",
        purl: "pkg:npm/custom",
        vers: "vers:npm/*",
        event: "deprecated",
        title: "encoded rule",
        severity: "low",
        sources: [],
        provenance: {
          method: "manual",
          reviewer: "armin",
          reviewedAt: "2026-11-12",
          observedAt: "2026-11-12",
        },
      },
    }),
  };

  const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (mockDb[url]) {
      return {
        status: 200,
        ok: true,
        json: async () => JSON.parse(mockDb[url]!),
      } as unknown as Response;
    }
    return {
      status: 404,
      ok: false,
      statusText: "Not Found",
    } as unknown as Response;
  };

  // 1. fetchMeta
  const meta = await fetchMeta({ fetch: mockFetch });
  assert.ok(meta);
  assert.equal(meta?.dataVersion, "2026.11.12");
  assert.equal(meta?.rulesCount, 830);

  // 2. fetchUpcoming
  const up = await fetchUpcoming({ fetch: mockFetch });
  assert.ok(up);
  assert.equal(up?.count, 1);
  assert.equal(up?.upcoming[0]?.ruleId, "nodejs.runtime.eol-22");

  // 3. fetchSingleRule for plain ID and encoded ID (Sub-issue 3)
  const plainRule = await fetchSingleRule("npm.package.request.deprecated", { fetch: mockFetch });
  assert.ok(plainRule);
  assert.equal(plainRule?.rule.id, "npm.package.request.deprecated");

  const encodedRule = await fetchSingleRule("custom/special@name", { fetch: mockFetch });
  assert.ok(encodedRule);
  assert.equal(encodedRule?.rule.id, "custom/special@name");

  // 4. 404 returns null (typed not found)
  assert.equal(await fetchSingleRule("nonexistent.rule", { fetch: mockFetch }), null);
  assert.equal(await fetchMeta({ fetch: async () => ({ status: 404, ok: false }) as Response }), null);
  assert.equal(await fetchUpcoming({ fetch: async () => ({ status: 404, ok: false }) as Response }), null);

  // 5. Automatic retry on network failure
  let attempts = 0;
  const retryFetch: typeof fetch = async () => {
    attempts++;
    if (attempts === 1) {
      throw new Error("Temporary network disconnection");
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({ schemaVersion: "ebb.api.v1", version: "0.3.0", dataVersion: "2026.11.12" }),
    } as unknown as Response;
  };

  const recovered = await fetchMeta({ fetch: retryFetch });
  assert.ok(recovered);
  assert.equal(attempts, 2, "Should have retried once after initial network failure");

  // 6. Timeout
  const slowFetch: typeof fetch = async (_input, init) => {
    return new Promise((resolve, reject) => {
      const signal = init?.signal;
      if (signal) {
        signal.addEventListener("abort", () => {
          reject(new Error("Request aborted due to timeout"));
        });
      }
      setTimeout(() => {
        resolve({ status: 200, ok: true, json: async () => ({}) } as Response);
      }, 500);
    });
  };

  await assert.rejects(() => fetchMeta({ fetch: slowFetch, timeout: 50 }), /Request aborted due to timeout|timed out/);
});

test("runSmokeTest validates target endpoints cleanly and detects broken URLs", async () => {
  const validDocs: Record<string, object> = {
    "https://velella.sh/ebb/api/v1/meta.json": {
      schemaVersion: "ebb.api.v1",
      version: "0.3.0",
      dataVersion: "2026.11.12",
      rulesCount: 1,
      componentsCount: 1,
      ecosystemsCount: 1,
      schemaVersions: { api: "ebb.api.v1", rule: "ebb.rule.v2", result: 1 },
    },
    "https://velella.sh/ebb/api/v1/npm/request.json": {
      schemaVersion: "ebb.api.v1",
      version: "0.3.0",
      generatedAt: "2026-11-12T00:00:00.000Z",
      purl: "pkg:npm/request",
      type: "npm",
      name: "request",
      ecosystems: ["npm"],
      rules: [
        {
          id: "npm.package.request.deprecated",
          ecosystem: "npm",
          purl: "pkg:npm/request",
          vers: "vers:npm/*",
          event: "deprecated",
          title: "request is deprecated",
          summary: "deprecated",
          severity: "high",
          sources: [{ title: "npm", url: "https://example.com", accessedAt: "2026-11-12" }],
          provenance: {
            method: "manual",
            reviewer: "armin",
            reviewedAt: "2026-11-12",
            observedAt: "2026-11-12",
          },
        },
      ],
    },
    "https://velella.sh/ebb/api/v1/rules/npm.package.request.deprecated.json": {
      schemaVersion: "ebb.api.v1",
      version: "0.3.0",
      generatedAt: "2026-11-12T00:00:00.000Z",
      rule: {
        id: "npm.package.request.deprecated",
        ecosystem: "npm",
        purl: "pkg:npm/request",
        vers: "vers:npm/*",
        event: "deprecated",
        title: "request is deprecated",
        summary: "deprecated",
        severity: "high",
        sources: [{ title: "npm", url: "https://example.com", accessedAt: "2026-11-12" }],
        provenance: {
          method: "manual",
          reviewer: "armin",
          reviewedAt: "2026-11-12",
          observedAt: "2026-11-12",
        },
      },
    },
    "https://velella.sh/ebb/api/v1/upcoming.json": {
      schemaVersion: "ebb.api.v1",
      version: "0.3.0",
      generatedAt: "2026-11-12T00:00:00.000Z",
      count: 0,
      upcoming: [],
    },
    "https://velella.sh/ebb/api/v1/renovate/generic/nodejs.json": {
      releases: [{ version: "18.x", isDeprecated: true }],
      homepage: "https://nodejs.org",
      sourceUrl: "https://github.com/nodejs/node",
    },
  };

  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
  const components = Object.fromEntries(
    ["nodejs", "ubuntu"].map((name) => {
      const purl = `pkg:generic/${name}`;
      return [
        purl,
        {
          purl,
          type: "generic",
          name,
          path: `generic/${name}.json`,
          url: `https://velella.sh/ebb/api/v1/generic/${name}.json`,
          ecosystems: [],
          events: [],
          rules: 0,
          sha256: "0".repeat(64),
          etag: "test",
          bytes: 0,
          card: { path: `cards/generic/${name}.svg`, sha256: sha256Hex(svg), bytes: Buffer.byteLength(svg) },
        },
      ];
    }),
  );
  validDocs["https://velella.sh/ebb/api/v1/index.json"] = {
    schemaVersion: "ebb.api.v1",
    version: "0.3.0",
    generatedAt: "2026-11-12T00:00:00.000Z",
    rulesCount: 0,
    componentsCount: 2,
    ecosystemsCount: 0,
    components,
  };

  const smokeMockFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (/\/cards\/generic\/(nodejs|ubuntu)\.svg$/u.test(url)) {
      return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
    }
    if (validDocs[url]) {
      return {
        status: 200,
        ok: true,
        json: async () => validDocs[url],
      } as Response;
    }
    return {
      status: 404,
      ok: false,
      statusText: "Not Found",
    } as Response;
  };

  // Smoke test passes on valid responses
  await runSmokeTest({
    baseUrl: "https://velella.sh/ebb/api/v1",
    fetch: smokeMockFetch,
  });

  await assert.rejects(
    () =>
      runSmokeTest({
        baseUrl: "https://velella.sh/ebb/api/v1",
        fetch: (input) =>
          String(input).endsWith("/cards/generic/ubuntu.svg")
            ? Promise.resolve(new Response(svg + " ", { headers: { "Content-Type": "image/svg+xml" } }))
            : smokeMockFetch(input),
      }),
    /ubuntu.svg does not match the indexed card/u,
  );

  // Smoke test fails when a URL is broken and names the URL
  const brokenFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("upcoming.json")) {
      return { status: 500, ok: false, statusText: "Server Error" } as Response;
    }
    return smokeMockFetch(input);
  };

  await assert.rejects(
    () => runSmokeTest({ baseUrl: "https://velella.sh/ebb/api/v1", fetch: brokenFetch }),
    (err: Error) => {
      assert.match(err.message, /https:\/\/velella\.sh\/ebb\/api\/v1\/upcoming\.json/);
      assert.match(err.message, /HTTP 500/);
      return true;
    },
  );
});

test("static API build with and without a source report", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "ebb-api-report-test-"));
  const outWithout = join(tempDir, "without-report");
  const outWith = join(tempDir, "with-report");
  const reportPath = join(tempDir, "mock-report.json");

  try {
    const ajv = new Ajv2020({ allErrors: true });
    const schema = JSON.parse(await readFile("schemas/static-api.v1.schema.json", "utf8")) as object;
    const regSchema = JSON.parse(await readFile("schemas/registry.v2.schema.json", "utf8")) as object;
    ajv.addSchema(regSchema, "registry.v2.schema.json");
    const validate = ajv.compile(schema);

    // 1. Build WITHOUT a report (does not fail, leaves fields out)
    await generateStaticApi({
      outDir: outWithout,
      reportPath: join(tempDir, "missing-report.json"),
    });

    const docWithout = JSON.parse(await readFile(join(outWithout, "npm/request.json"), "utf8"));
    assert.equal(validate(docWithout), true, `Validation failed: ${JSON.stringify(validate.errors)}`);
    assert.equal(docWithout.rules[0]?.sourceCheckedAt, undefined);
    assert.equal(docWithout.rules[0]?.sourceStatus, undefined);

    // 2. Build WITH a report (populates sourceCheckedAt and sourceStatus)
    await writeFile(
      reportPath,
      JSON.stringify({
        schemaVersion: "ebb.source-check.v1",
        checkedAt: "2026-11-15T12:00:00Z",
        unreachable: [
          { url: "https://example.com/dead", reason: "HTTP 404", ruleIds: ["npm.package.request.deprecated"] },
        ],
      }),
      "utf8",
    );

    await generateStaticApi({
      outDir: outWith,
      reportPath,
    });

    const docWith = JSON.parse(await readFile(join(outWith, "npm/request.json"), "utf8"));
    assert.equal(validate(docWith), true, `Validation failed: ${JSON.stringify(validate.errors)}`);
    assert.equal(docWith.rules[0]?.sourceCheckedAt, "2026-11-15");
    assert.equal(docWith.rules[0]?.sourceStatus, "unreachable");

    // Check another rule that was ok
    const allDoc = JSON.parse(await readFile(join(outWith, "all.json"), "utf8"));
    assert.equal(validate(allDoc), true);
    const otherRule = allDoc.rules.find((r: { id: string }) => r.id !== "npm.package.request.deprecated");
    assert.ok(otherRule);
    assert.equal(otherRule.sourceCheckedAt, "2026-11-15");
    assert.equal(otherRule.sourceStatus, "ok");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("EBB_OFFLINE=1 blocks static API client requests with offline code", async () => {
  const prev = process.env.EBB_OFFLINE;
  try {
    process.env.EBB_OFFLINE = "1";
    await assert.rejects(
      () => fetchMeta(),
      // biome-ignore lint/suspicious/noExplicitAny: error code inspection
      (err: any) => err?.code === "offline",
    );
  } finally {
    if (prev === undefined) delete process.env.EBB_OFFLINE;
    else process.env.EBB_OFFLINE = prev;
  }
});

test("static-api: generates /releases.json from release log sorted newest first (release-log-5)", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "ebb-static-api-rel-"));
  const { appendReleaseLog } = await import("../src/data-release-log.js");
  const log1 = appendReleaseLog("", {
    version: "2026.10.16",
    contentDigest: `sha256:${"1".repeat(64)}`,
    bundleSha256: `sha256:${"2".repeat(64)}`,
    createdAt: "2026-10-16T00:00:00Z",
  });
  const log2 = appendReleaseLog(log1, {
    version: "2026.11.11",
    contentDigest: `sha256:${"3".repeat(64)}`,
    bundleSha256: `sha256:${"4".repeat(64)}`,
    createdAt: "2026-11-11T00:00:00Z",
  });
  const logPath = join(tmp, "release-log.jsonl");
  await writeFile(logPath, log2, "utf8");

  const outDir = join(tmp, "api-out");
  await generateStaticApi({ outDir, releaseLogPath: logPath });

  const raw = await readFile(join(outDir, "releases.json"), "utf8");
  const doc = JSON.parse(raw);

  const schemaRaw = await readFile("schemas/static-api.v1.schema.json", "utf8");
  const schema = JSON.parse(schemaRaw) as object;
  const regSchema = JSON.parse(await readFile("schemas/registry.v2.schema.json", "utf8")) as object;
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(regSchema, "registry.v2.schema.json");
  const validate = ajv.compile(schema);
  assert.equal(validate(doc), true, `releases.json validation failed: ${JSON.stringify(validate.errors)}`);

  assert.equal(doc.count, 2);
  assert.equal(doc.releases.length, 2);
  // Newest first
  assert.equal(doc.releases[0].version, "2026.11.11");
  assert.equal(doc.releases[1].version, "2026.10.16");
  assert.equal(doc.releases[0].url, "https://github.com/velella-sh/ebb/releases/tag/data-v2026.11.11");
  assert.ok(doc.releases[0].counts);
  await rm(tmp, { recursive: true, force: true });
});
