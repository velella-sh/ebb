import assert from "node:assert/strict";
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

const SEMVER_SPECIFIER = /from\s+["']semver(?:\/[^"']*)?["']|require\(["']semver(?:\/[^"']*)?["']\)/;

test("package metadata and source/tool code have zero dependency on semver", async () => {
  const pkg = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert.equal(pkg.dependencies?.semver, undefined);
  assert.equal(pkg.devDependencies?.semver, undefined);
  assert.equal(pkg.devDependencies?.["@types/semver"], undefined);

  const lock = JSON.parse(await readFile(resolve("package-lock.json"), "utf8")) as {
    packages?: Record<string, { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>;
  };
  const rootPkg = lock.packages?.[""];
  assert.equal(rootPkg?.dependencies?.semver, undefined);
  assert.equal(rootPkg?.devDependencies?.semver, undefined);
  assert.equal(rootPkg?.devDependencies?.["@types/semver"], undefined);

  for (const dir of ["src", "tools"]) {
    for (const file of await collectTsFiles(resolve(dir))) {
      const content = await readFile(file, "utf8");
      assert.doesNotMatch(content, SEMVER_SPECIFIER, `${file} must not import external "semver"`);
    }
  }
});
