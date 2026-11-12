import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import { fetchComponent, fetchRule, purlToApiPath } from "../src/api.js";
import { generateStaticApi } from "../tools/static-api/generate.js";

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
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
    assert.equal(requestDoc.version, "0.1.1");
    assert.equal(requestDoc.generatedAt, "2026-11-12T00:00:00.000Z");
    assert.ok(requestDoc.hint?.includes("velella-sh/offing"));
    assert.ok(requestDoc.rules.length > 0);

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

    // Verify percent-encoded alias for scoped packages (e.g. %40types)
    const encodedCheck = await readFile(join(tempDir, "npm/@types/form-data.json"), "utf8");
    assert.ok(encodedCheck.length > 0);
    const aliasCheck = await readFile(join(tempDir, "npm/%40types/form-data.json"), "utf8");
    assert.equal(aliasCheck, encodedCheck);
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
      hint: "Offing can fix this: https://github.com/velella-sh/offing",
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
  assert.equal(comp?.hint, "Offing can fix this: https://github.com/velella-sh/offing");

  // Test fetchRule with matching version
  const rules = await fetchRule("pkg:npm/request@2.88.2", { fetch: mockFetch });
  assert.ok(rules);
  assert.equal(rules?.length, 1);
  assert.equal(rules?.[0]?.id, "npm.package.request.deprecated");

  // Test fetchRule without version returns all rules
  const allRules = await fetchRule("pkg:npm/request", { fetch: mockFetch });
  assert.ok(allRules);
  assert.equal(allRules?.length, 1);

  // Test fetchComponent not found returns null
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
