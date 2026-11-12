#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { generateStaticApi } from "./generate.js";

function getArg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : undefined;
}

export async function main(argv: string[]): Promise<void> {
  const root = resolve(getArg(argv, "--root") ?? process.cwd());
  const outDir = resolve(getArg(argv, "--out") ?? "dist/site/api/v1");
  const baseUrl = getArg(argv, "--base-url");
  const createdAt = getArg(argv, "--created-at");

  const result = await generateStaticApi({
    root,
    outDir,
    ...(baseUrl ? { baseUrl } : {}),
    ...(createdAt ? { createdAt } : {}),
  });

  process.stderr.write(
    `Ebb Static API generated at ${result.outDir}:\n` +
      `  Components: ${result.componentCount}\n` +
      `  Ecosystems: ${result.ecosystemCount}\n` +
      `  Rules:      ${result.ruleCount}\n` +
      `  all.json:   ${result.allRawBytes} bytes (${(result.allGzipBytes / 1024).toFixed(1)} KB gzipped)\n` +
      `  index.json: ${result.indexRawBytes} bytes (${(result.indexGzipBytes / 1024).toFixed(1)} KB gzipped)\n` +
      `  search:     ${result.searchRawBytes} bytes (${(result.searchGzipBytes / 1024).toFixed(1)} KB gzipped)\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  });
}
