import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

async function collectJsModules(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const modules: string[] = [];
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      modules.push(...(await collectJsModules(rootDir, fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      modules.push(relative(rootDir, fullPath).replaceAll("\\", "/").slice(0, -".js".length));
    }
  }
  return modules.sort();
}

test("every exported entry point installs and loads cleanly from a packed tarball", async () => {
  const repoRoot = resolve(".");
  const tempRoot = await mkdtemp(join(tmpdir(), "ebb-pack-test-"));
  try {
    // Build already runs before tests; skip prepack so parallel test workers do not race on dist/.
    const packStdout = execFileSync(npmCmd, ["pack", "--silent", "--ignore-scripts", "--pack-destination", tempRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const tarballName = packStdout.split(/\r?\n/).filter(Boolean).at(-1);
    assert.ok(tarballName, `expected npm pack to print tarball filename, got: "${packStdout}"`);
    const tarballPath = join(tempRoot, tarballName);

    const appDir = join(tempRoot, "app");
    await mkdir(appDir, { recursive: true });
    await writeFile(
      join(appDir, "package.json"),
      JSON.stringify({ name: "ebb-pack-consumer", version: "1.0.0", private: true, type: "module" }, null, 2),
      "utf8",
    );

    execFileSync(npmCmd, ["install", "--prefer-offline", "--no-audit", "--no-fund", tarballPath], {
      cwd: appDir,
      stdio: "pipe",
    });

    const installedDistSrc = join(appDir, "node_modules", "@velella", "ebb", "dist", "src");
    const subpaths = (await collectJsModules(installedDistSrc)).filter((name) => name !== "index");
    assert.ok(subpaths.length >= 40, `expected >= 40 dist/src subpaths in tarball, found ${subpaths.length}`);

    const verifyScript = join(appDir, "verify.mjs");
    await writeFile(
      verifyScript,
      `
import assert from "node:assert/strict";

const root = await import("@velella/ebb");
assert.deepEqual(Object.keys(root).sort(), ["check", "checkAll", "replacementFor", "rulesFor"]);
assert.equal(root.check("node", "18.20.4").status, "end-of-life");
assert.ok(root.rulesFor("pkg:npm/request").length > 0);
assert.equal(root.replacementFor("pkg:npm/node-sass", "9.0.0"), "pkg:npm/sass");
assert.equal(root.checkAll([{ purl: "pkg:npm/left-pad", version: "1.3.0" }]).summary.byStatus.deprecated, 1);

const pkg = await import("@velella/ebb/package.json", { with: { type: "json" } });
assert.equal(pkg.default.name, "@velella/ebb");

const subpaths = JSON.parse(process.env.EBB_SUBPATHS);
for (const subpath of subpaths) {
  const mod = await import(\`@velella/ebb/\${subpath}\`);
  assert.equal(typeof mod, "object", \`expected object module for \${subpath}\`);
  assert.notEqual(mod, null, \`expected non-null module for \${subpath}\`);
}
console.log(JSON.stringify({ verifiedSubpaths: subpaths.length }));
`,
      "utf8",
    );

    const verifyStdout = execFileSync(process.execPath, [verifyScript], {
      cwd: appDir,
      encoding: "utf8",
      env: { ...process.env, EBB_SUBPATHS: JSON.stringify(subpaths) },
    });
    const parsed = JSON.parse(verifyStdout) as { verifiedSubpaths: number };
    assert.equal(parsed.verifiedSubpaths, subpaths.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
