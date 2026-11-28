import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalog, Schema } from "./diff.js";

const releaseTag = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;

function git(workspace: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: workspace, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trimEnd();
}

function isSchemaPath(path: string): boolean {
  return path !== "schemas/deprecations.json" && /^schemas\/(?:[^/]+|lifecycle\/.+)\.json$/u.test(path);
}

function parseSchema(path: string, text: string): Schema {
  const document: unknown = JSON.parse(text);
  if (
    typeof document === "boolean" ||
    (document !== null && typeof document === "object" && !Array.isArray(document))
  ) {
    return document as Schema;
  }
  throw new Error(`${path} is not a JSON Schema object or boolean.`);
}

export function readReleaseBaseline(workspace: string): { tag: string; commit: string; schemas: Catalog } {
  if (git(workspace, "rev-parse", "--is-shallow-repository") === "true") {
    throw new Error("Schema evolution needs full Git history and release tags. Run git fetch --unshallow --tags.");
  }
  const tag = git(workspace, "tag", "--merged", "HEAD", "--sort=-version:refname")
    .split("\n")
    .find((candidate) => releaseTag.test(candidate));
  if (!tag)
    throw new Error("No stable package release tag reachable from HEAD. Fetch release tags with git fetch --tags.");
  const commit = git(workspace, "rev-parse", `${tag}^{commit}`);
  const manifest = JSON.parse(git(workspace, "show", `${commit}:package.json`)) as { version?: string };
  if (`v${manifest.version}` !== tag) throw new Error(`Package version at ${tag} does not match the release tag.`);

  const paths = git(workspace, "ls-tree", "-r", "--name-only", "-z", commit, "--", "schemas")
    .split("\0")
    .filter(isSchemaPath);
  if (!paths.length) throw new Error(`The release tag ${tag} has no first-party schemas.`);
  return {
    tag,
    commit,
    schemas: new Map(paths.map((path) => [path, parseSchema(path, git(workspace, "show", `${commit}:${path}`))])),
  };
}

export function readWorkingSchemas(workspace: string): Catalog {
  function pathsBelow(path: string, recursive: boolean): string[] {
    return readdirSync(join(workspace, path), { withFileTypes: true }).flatMap((entry) => {
      const file = `${path}/${entry.name}`;
      if (entry.isDirectory() && (recursive || file === "schemas/lifecycle")) return pathsBelow(file, true);
      if (entry.isSymbolicLink() && isSchemaPath(file)) throw new Error(`Expected a regular schema file at ${file}.`);
      return entry.isFile() && isSchemaPath(file) ? [file] : [];
    });
  }
  const paths = existsSync(join(workspace, "schemas")) ? pathsBelow("schemas", false) : [];
  return new Map(paths.map((path) => [path, parseSchema(path, readFileSync(join(workspace, path), "utf8"))]));
}
