#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

export interface SmokeTestOptions {
  baseUrl: string;
  root?: string;
  fetch?: typeof fetch;
}

export async function runSmokeTest(options: SmokeTestOptions): Promise<void> {
  const root = resolve(options.root ?? ".");
  const fetchFn = options.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("No global fetch available. Pass a custom fetch implementation.");
  }

  const ajv = new Ajv2020({ allErrors: true });
  const schema = JSON.parse(await readFile(resolve(root, "schemas/static-api.v1.schema.json"), "utf8")) as object;
  const regSchema = JSON.parse(await readFile(resolve(root, "schemas/registry.v2.schema.json"), "utf8")) as object;
  ajv.addSchema(regSchema, "registry.v2.schema.json");
  const validate = ajv.compile(schema);

  let cleanBase = options.baseUrl;
  while (cleanBase.endsWith("/")) {
    cleanBase = cleanBase.slice(0, -1);
  }
  const targetUrls = [
    `${cleanBase}/meta.json`,
    `${cleanBase}/npm/request.json`,
    `${cleanBase}/rules/npm.package.request.deprecated.json`,
    `${cleanBase}/upcoming.json`,
  ];

  for (const url of targetUrls) {
    let res: Response;
    try {
      res = await fetchFn(url);
    } catch (err) {
      throw new Error(`Smoke test failed: network error requesting ${url}: ${(err as Error).message}`);
    }

    if (!res.ok) {
      throw new Error(`Smoke test failed: ${url} returned HTTP ${res.status} ${res.statusText}`);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      throw new Error(`Smoke test failed: ${url} returned invalid JSON: ${(err as Error).message}`);
    }

    const isValid = validate(body);
    if (!isValid) {
      const errorDetails = JSON.stringify(validate.errors, null, 2);
      throw new Error(`Smoke test failed: schema validation failed for ${url}:\n${errorDetails}`);
    }
  }

  // Smoke test Renovate custom datasource feed
  const renovateUrl = `${cleanBase}/renovate/generic/nodejs.json`;
  let renovateRes: Response;
  try {
    renovateRes = await fetchFn(renovateUrl);
  } catch (err) {
    throw new Error(`Smoke test failed: network error requesting ${renovateUrl}: ${(err as Error).message}`);
  }
  if (!renovateRes.ok) {
    throw new Error(`Smoke test failed: ${renovateUrl} returned HTTP ${renovateRes.status} ${renovateRes.statusText}`);
  }
  let renovateBody: { releases?: Array<{ version?: string; isDeprecated?: boolean }> };
  try {
    renovateBody = (await renovateRes.json()) as { releases?: Array<{ version?: string; isDeprecated?: boolean }> };
  } catch (err) {
    throw new Error(`Smoke test failed: ${renovateUrl} returned invalid JSON: ${(err as Error).message}`);
  }
  if (!Array.isArray(renovateBody.releases) || renovateBody.releases.length === 0) {
    throw new Error(`Smoke test failed: ${renovateUrl} missing releases array`);
  }
}

export async function main(argv: string[]): Promise<void> {
  const baseUrl = argv[0] ?? "https://velella.sh/ebb/api/v1";
  process.stderr.write(`Starting smoke test against ${baseUrl}...\n`);
  try {
    await runSmokeTest({ baseUrl });
    process.stderr.write(`Smoke test passed: all 5 endpoints fetched and validated cleanly.\n`);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
