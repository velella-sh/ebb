#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { generateSiteData } from "./generate.js";
import { writeSitePages } from "./pages.js";
import { readSiteRelease } from "./release.js";
import { validateSiteDataDir } from "./validate.js";

function getArg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : undefined;
}

export async function main(argv: string[]): Promise<void> {
  const root = resolve(getArg(argv, "--root") ?? process.cwd());
  const outDir = resolve(getArg(argv, "--out") ?? "dist/site-data");
  const baseUrl = getArg(argv, "--base-url");
  const dataVersion = getArg(argv, "--data-version");
  const updateLock = argv.includes("--update-lock");
  const bundlePath = getArg(argv, "--bundle");
  const signaturePath = getArg(argv, "--signature");
  const sha256 = getArg(argv, "--sha256");
  const historicalVerifier = getArg(argv, "--historical-verifier");
  const mizzenOut = getArg(argv, "--mizzen-out");
  const asOf = getArg(argv, "--as-of");
  const shouldValidate = argv.includes("--validate") || bundlePath !== undefined;
  if (!bundlePath && (signaturePath || sha256 || historicalVerifier || mizzenOut)) {
    throw new Error("Signed release options require --bundle.");
  }
  if (bundlePath && (!signaturePath || !sha256 || !dataVersion)) {
    throw new Error("Signed site data requires --signature, --sha256 and --data-version.");
  }
  const rules =
    bundlePath && signaturePath && sha256 && dataVersion
      ? await readSiteRelease({ bundlePath, signaturePath, version: dataVersion, sha256, historicalVerifier })
      : undefined;

  const result = await generateSiteData({
    root,
    outDir,
    baseUrl,
    dataVersion,
    updateLock,
    rules,
  });

  process.stderr.write(
    `Ebb Site Data generated at ${result.outDir}:\n` +
      `  Data Version: ${result.dataVersion}\n` +
      `  Components:   ${result.componentCount}\n` +
      `  Rules:        ${result.ruleCount}\n` +
      `  Lines:        ${result.lineCount}\n` +
      `  Ecosystems:   ${result.ecosystemCount}\n` +
      `  Files:        ${result.files.length}\n` +
      `  Total size:   ${result.totalBytes} bytes (${(result.totalGzipBytes / 1024).toFixed(1)} KB gzipped)\n`,
  );

  if (shouldValidate) {
    const valResult = await validateSiteDataDir(outDir, { root });
    process.stderr.write(`✅ Site data validated against schema (${valResult.checkedFiles} files checked).\n`);
  }
  if (mizzenOut && rules) {
    await writeSitePages({ from: outDir, out: mizzenOut, version: result.dataVersion, rules, asOf });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  });
}
