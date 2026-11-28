import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TestContext } from "node:test";

export function repository(t: TestContext) {
  const path = mkdtempSync(join(tmpdir(), "ebb-schema-evolution-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  function git(...args: string[]): string {
    return execFileSync("git", args, { cwd: path, encoding: "utf8" }).trim();
  }
  function write(file: string, document: unknown) {
    const absolute = join(path, file);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, JSON.stringify(document));
  }
  function tag(version: string) {
    write("package.json", { version });
    git("add", ".");
    git("commit", "-qm", version);
    git("tag", "-a", `v${version}`, "-m", version);
    return git("rev-parse", "HEAD");
  }
  git("init", "-qb", "main");
  git("config", "user.name", "Ebb schema fixture");
  git("config", "user.email", "schema-fixture@example.invalid");
  return { path, git, write, tag };
}
