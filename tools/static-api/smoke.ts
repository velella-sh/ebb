#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { CardIndexEntry } from "./cards.js";
import { eolDateBaseUrl } from "./eoldate.js";

export interface SmokeTestOptions {
  baseUrl: string;
  root?: string;
  fetch?: typeof fetch;
  eolCompatSha256?: string;
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
    `${cleanBase}/index.json`,
    `${cleanBase}/npm/request.json`,
    `${cleanBase}/rules/npm.package.request.deprecated.json`,
    `${cleanBase}/upcoming.json`,
  ];

  for (const url of targetUrls) {
    let res: Response;
    try {
      res = await fetchFn(url, { cache: "no-store" });
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
    if (url === `${cleanBase}/index.json`) {
      const { components } = body as { components?: Record<string, { card?: CardIndexEntry }> };
      for (const purl of ["pkg:generic/nodejs", "pkg:generic/ubuntu"]) {
        const card = components?.[purl]?.card;
        if (!card) throw new Error(`Smoke test failed: missing card for ${purl} in ${url}`);
        const cardUrl = `${cleanBase}/${card.path}`;
        const response = await fetchFn(cardUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Smoke test failed: ${cardUrl} returned HTTP ${response.status}`);
        if (response.headers.get("content-type")?.split(";")[0] !== "image/svg+xml") {
          throw new Error(`Smoke test failed: ${cardUrl} did not return SVG`);
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== card.bytes || createHash("sha256").update(bytes).digest("hex") !== card.sha256) {
          throw new Error(`Smoke test failed: ${cardUrl} does not match the indexed card`);
        }
      }
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

  if (options.eolCompatSha256 !== undefined) {
    await verifyCompatibilityDeployment(fetchFn, eolDateBaseUrl(cleanBase), options.eolCompatSha256);
  }
}

async function verifyCompatibilityDeployment(
  fetchFn: typeof fetch,
  baseUrl: string,
  expectedHash: string,
): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error("Smoke test failed: missing or invalid built compatibility response digest");
  }
  for (const productPath of ["products/nodejs.json", "products/nodejs"]) {
    const url = new URL(productPath, baseUrl);
    const response = await fetchFn(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Smoke test failed: ${url} returned HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(body).digest("hex") !== expectedHash) {
      throw new Error(`Smoke test failed: ${url} does not match the built compatibility response`);
    }
  }
  const unknown = new URL("products/ebb-unknown-compat-product.json", baseUrl);
  const response = await fetchFn(unknown, { cache: "no-store" });
  if (response.status !== 404) throw new Error(`Smoke test failed: ${unknown} did not return HTTP 404`);
}

export async function main(argv: string[]): Promise<void> {
  const baseUrl = argv[0] ?? "https://velella.sh/ebb/api/v1";
  process.stderr.write(`Starting smoke test against ${baseUrl}...\n`);
  try {
    const eolCompatSha256 = argv[1];
    await runSmokeTest({ baseUrl, ...(eolCompatSha256 === undefined ? {} : { eolCompatSha256 }) });
    process.stderr.write("Smoke test passed: all requested endpoints validated.\n");
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
