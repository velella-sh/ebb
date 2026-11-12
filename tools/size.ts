import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

interface PackFile {
  path: string;
  size: number;
  mode: number;
}

interface PackResult {
  id: string;
  name: string;
  version: string;
  size: number;
  unpackedSize: number;
  shasum: string;
  integrity: string;
  filename: string;
  files: PackFile[];
  entryCount: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = (bytes / 1024).toFixed(1);
  return `${kb} KB (${bytes.toLocaleString()} bytes)`;
}

export function measureSize(): {
  packedSize: number;
  unpackedSize: number;
  budget: number;
  topFiles: PackFile[];
  dataGzipSize: number;
} {
  const pkgJson = JSON.parse(readFileSync("package.json", "utf-8"));
  const budget = pkgJson.ebb?.sizeBudget ?? 500000;

  const stdout = execSync("npm pack --dry-run --json", { encoding: "utf-8" });
  const parsed: PackResult[] = JSON.parse(stdout);
  const pack = parsed[0];
  if (!pack) {
    throw new Error("No pack result returned by npm pack");
  }

  // Top 10 largest files
  const topFiles = [...pack.files].sort((a, b) => b.size - a.size).slice(0, 10);

  // Measure gzip size of data files in registry
  let totalDataRaw = Buffer.alloc(0);
  for (const f of pack.files) {
    if (f.path.startsWith("registry/") && f.path.endsWith(".json")) {
      try {
        const content = readFileSync(f.path);
        totalDataRaw = Buffer.concat([totalDataRaw, content]);
      } catch {
        // File may be generated
      }
    }
  }
  const dataGzipSize = totalDataRaw.length > 0 ? gzipSync(totalDataRaw).length : 0;

  console.log(`Package: ${pack.name}@${pack.version}`);
  console.log(`Packed size:   ${formatBytes(pack.size)}`);
  console.log(`Unpacked size: ${formatBytes(pack.unpackedSize)}`);
  console.log(`Size budget:   ${formatBytes(budget)}`);
  if (dataGzipSize > 0) {
    console.log(`Registry data (gzipped): ${formatBytes(dataGzipSize)}`);
  }

  console.log("\nTop 10 largest packed files:");
  for (const f of topFiles) {
    console.log(`  ${f.path.padEnd(40)} ${formatBytes(f.size)}`);
  }

  if (pack.size > budget) {
    console.error(`\n❌ Error: Packed size (${pack.size} bytes) exceeds budget of ${budget} bytes!`);
    process.exit(1);
  }

  console.log("\n✅ Size check passed (within budget).");
  return {
    packedSize: pack.size,
    unpackedSize: pack.unpackedSize,
    budget,
    topFiles,
    dataGzipSize,
  };
}

if (process.argv[1]?.endsWith("size.ts") || process.argv[1]?.endsWith("size.js")) {
  measureSize();
}
