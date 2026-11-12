import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { bundledRules } from "../src/bundled-rules.js";
import { check, checkAll, replacementFor, rulesFor } from "../src/index.js";
import { parsePurl } from "../src/purl.js";

const root = process.cwd();
const llmsPath = join(root, "llms.txt");
const llmsFullPath = join(root, "llms-full.txt");
const packageJsonPath = join(root, "package.json");

test("llms.txt and llms-full.txt exist and conform to llmstxt specification", () => {
  assert.ok(existsSync(llmsPath), "llms.txt must exist in repository root");
  assert.ok(existsSync(llmsFullPath), "llms-full.txt must exist in repository root");

  const llms = readFileSync(llmsPath, "utf-8");
  const llmsFull = readFileSync(llmsFullPath, "utf-8");

  assert.ok(llms.startsWith("# Ebb"), "llms.txt starts with project title");
  assert.ok(llms.includes("> The open almanac"), "llms.txt has blockquote summary");
  assert.ok(llms.includes("## When to Use Ebb (Guidance for AI Agents)"), "llms.txt has agent guidance");
  assert.ok(llms.includes("## Core API Reference"), "llms.txt has core API reference");
  assert.ok(llms.includes("## CLI Quick Reference"), "llms.txt has CLI instructions");
  assert.ok(llms.includes("## MCP Server"), "llms.txt documents MCP integration");
  assert.ok(llms.includes("## Links and Resources"), "llms.txt has documentation links section");
  assert.ok(llms.includes("- [Documentation]("), "llms.txt links documentation");

  assert.ok(llmsFull.length > llms.length, "llms-full.txt is extended");
  assert.ok(llmsFull.includes("Rule Format Specification"), "llms-full.txt documents rule schema");
  assert.ok(llmsFull.includes("Complete TypeScript Type Reference"), "llms-full.txt includes type docs");
});

test("every code example documented in llms.txt executes accurately", async () => {
  // Example 1: check()
  const checkRes = check("pkg:npm/request", "2.88.2");
  assert.equal(checkRes.status, "deprecated");
  assert.ok(checkRes.matches.length > 0);
  assert.equal(checkRes.matches[0]?.replacement, "Native fetch or a maintained HTTP client");

  // Example 2: checkAll()
  const checkAllRes = checkAll([
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:generic/nodejs", version: "24.0.0" },
  ]);
  assert.equal(checkAllRes.summary.total, 2);
  assert.equal(checkAllRes.summary.byStatus.deprecated, 1);
  assert.equal(checkAllRes.summary.byStatus.ok, 1);

  // Example 3: rulesFor()
  const rules = rulesFor("pkg:npm/node-sass");
  assert.ok(rules.length > 0);
  assert.equal(rules[0]?.ecosystem, "npm");

  // Example 4: replacementFor()
  const rep = replacementFor("pkg:npm/node-sass", "4.14.1");
  assert.equal(rep, "pkg:npm/sass");

  // Example 5: parsePurl()
  const parsed = parsePurl("pkg:npm/%40babel/core@7.24.0");
  assert.equal(parsed.type, "npm");
  assert.equal(parsed.namespace, "@babel");
  assert.equal(parsed.name, "core");

  // Example 6: bundledRules()
  const all = await bundledRules();
  assert.ok(all.length >= 300);
});

test("package.json files array includes llms.txt and llms-full.txt", () => {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  assert.ok(pkg.files.includes("llms.txt"), "package.json files must include llms.txt");
  assert.ok(pkg.files.includes("llms-full.txt"), "package.json files must include llms-full.txt");
});
