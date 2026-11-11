import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";

async function collectTsFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(fullPath)));
    } else if (entry.isFile() && /\.[cm]?ts$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const EXTERNAL_IMPORT_PATTERN =
  /^\s*(?:import\s+(?:type\s+)?(?:[\s\S]*?from\s+)?["'](?!(?:\.{1,2}\/|node:))([^"']+)["']|const\s+.*=\s*require\(["'](?!(?:\.{1,2}\/|node:))([^"']+)["']\))/gm;

test("package.json declares exactly zero runtime dependencies", async () => {
  const pkg = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const deps = Object.keys(pkg.dependencies ?? {});
  assert.deepEqual(deps, [], `package.json dependencies must be empty, but found: ${deps.join(", ")}`);
});

test("package-lock.json root package carries zero runtime dependencies", async () => {
  const lock = JSON.parse(await readFile(resolve("package-lock.json"), "utf8")) as {
    packages?: Record<string, { dependencies?: Record<string, string> }>;
  };
  const rootDeps = Object.keys(lock.packages?.[""]?.dependencies ?? {});
  assert.deepEqual(
    rootDeps,
    [],
    `package-lock.json root dependencies must be empty, but found: ${rootDeps.join(", ")}`,
  );
});

test("src/ has zero external imports and depends solely on node built-ins and internal modules", async () => {
  const srcFiles = await collectTsFiles(resolve("src"));
  assert.ok(srcFiles.length > 0, "must find src/ TypeScript files");

  for (const file of srcFiles) {
    const content = await readFile(file, "utf8");
    const matches = [...content.matchAll(EXTERNAL_IMPORT_PATTERN)];
    const externalImports = matches.map((m) => m[1] ?? m[2]);
    assert.deepEqual(externalImports, [], `${file} must not import external package: ${externalImports.join(", ")}`);
  }
});

test("npm ls --omit=dev reports an empty dependency tree", () => {
  const output = execFileSync("npm", ["ls", "--omit=dev"], {
    cwd: resolve("."),
    encoding: "utf8",
  });
  assert.match(output, /\(empty\)/, "npm ls --omit=dev must output (empty)");
});
