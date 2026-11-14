// Builds the lifecycle data bundle from registry/.
//
//   npm run build --silent
//   node dist/tools/build-data-bundle.js --created-at 2026-10-16T09:30:00Z --out dist/data/bundle.json
//
// The build is deterministic: the same registry files and the same --created-at give the same bytes. It never reads
// a clock; the release workflow passes the release commit's date. Prints the version and content digest.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildDataBundle,
  compressBundle,
  serializeDataBundle,
  sha256Hex,
  type BundledEcosystem,
} from "../src/data-bundle.js";

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function flag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

export async function main(argv: string[]): Promise<void> {
  const createdAt = option(argv, "--created-at");
  if (!createdAt)
    throw new Error("--created-at is required, for example 2026-10-16T09:30:00Z (the release commit's date).");
  const revision = option(argv, "--revision");
  const sequence = option(argv, "--sequence");
  const format = (option(argv, "--format") as "v1" | "v2" | undefined) ?? "v2";
  const ecosystem = option(argv, "--ecosystem") as BundledEcosystem | undefined;
  const isGzip = flag(argv, "--gzip");
  const root = resolve(option(argv, "--root") ?? ".");
  // The registry and the code that reads a bundle are Ebb's, so the bundle names the Ebb release that can read it.
  const ebbRoot = resolve(root);
  const packageVersion = (JSON.parse(await readFile(resolve(ebbRoot, "package.json"), "utf8")) as { version: string })
    .version;

  const bundle = await buildDataBundle({
    root: ebbRoot,
    createdAt,
    format,
    ...(revision ? { revision: Number(revision) } : {}),
    ...(sequence ? { sequence: Number(sequence) } : {}),
    ...(ecosystem ? { ecosystem } : {}),
    minimumEbbVersion: option(argv, "--minimum-version") ?? packageVersion,
  });
  const text = serializeDataBundle(bundle);
  const out = option(argv, "--out");
  if (out) {
    await mkdir(dirname(resolve(out)), { recursive: true });
    await writeFile(resolve(out), text);
    if (isGzip || out.endsWith(".gz")) {
      const gzPath = out.endsWith(".gz") ? resolve(out) : `${resolve(out)}.gz`;
      await writeFile(gzPath, compressBundle(text));
    }
  } else {
    process.stdout.write(text);
  }
  process.stderr.write(
    `data bundle ${bundle.manifest.version} (${bundle.manifest.schemaVersion}): ${bundle.manifest.contentDigest}, file sha256:${sha256Hex(text)}${out ? `, wrote ${resolve(out)}` : ""}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  });
}
