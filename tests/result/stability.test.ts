import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

type StabilityTag = "@stable" | "@experimental";

function interfaceFieldTags(sourceText: string): Map<string, Map<string, StabilityTag>> {
  const sourceFile = ts.createSourceFile("src/result.ts", sourceText, ts.ScriptTarget.Latest, true);
  const interfaces = new Map<string, Map<string, StabilityTag>>();

  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue;
    if (statement.name.text !== "Result" && statement.name.text !== "ResultMatch") continue;

    const fields = new Map<string, StabilityTag>();
    for (const member of statement.members) {
      if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
      const fieldName = member.name.text;
      const tags = ts
        .getJSDocTags(member)
        .map((tag) => `@${tag.tagName.text}`)
        .filter((tag): tag is StabilityTag => tag === "@stable" || tag === "@experimental");

      assert.equal(
        tags.length,
        1,
        `${statement.name.text}.${fieldName} must have exactly one @stable or @experimental tag, found [${tags.join(", ")}]`,
      );
      fields.set(fieldName, tags[0]!);
    }
    interfaces.set(statement.name.text, fields);
  }

  return interfaces;
}

function docTableTags(markdown: string, heading: string): Map<string, StabilityTag> {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  assert.ok(headingIndex !== -1, `docs/result-model.md is missing heading: ${heading}`);

  const rows = new Map<string, StabilityTag>();
  let inTable = false;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line.startsWith("#")) break;
    if (!line.startsWith("|")) {
      if (inTable) break;
      continue;
    }
    inTable = true;
    const cells = line
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim());
    if (cells[0] === "Field" || cells[0]?.startsWith("---")) continue;
    const fieldName = cells[0]?.replace(/^`|`$/g, "");
    const stability = cells[2]?.replace(/^`|`$/g, "");
    assert.ok(fieldName, `Malformed row in ${heading}: ${line}`);
    assert.ok(
      stability === "@stable" || stability === "@experimental",
      `${heading}.${fieldName} in docs/result-model.md must declare @stable or @experimental, got "${stability ?? ""}"`,
    );
    rows.set(fieldName, stability);
  }
  return rows;
}

test("every Result and ResultMatch field has a matching @stable or @experimental tag in JSDoc and docs", async () => {
  const [sourceText, markdown] = await Promise.all([
    readFile(resolve("src/result.ts"), "utf8"),
    readFile(resolve("docs/result-model.md"), "utf8"),
  ]);

  const codeInterfaces = interfaceFieldTags(sourceText);
  const resultFields = codeInterfaces.get("Result");
  const matchFields = codeInterfaces.get("ResultMatch");
  assert.ok(resultFields && resultFields.size > 0, "Result interface must declare fields");
  assert.ok(matchFields && matchFields.size > 0, "ResultMatch interface must declare fields");

  const docResult = docTableTags(markdown, "## `check` → `Result` (`CheckResult`)");
  const docMatch = docTableTags(markdown, "### `ResultMatch` (`CheckMatch`)");

  assert.deepEqual([...docResult.entries()], [...resultFields.entries()]);
  assert.deepEqual([...docMatch.entries()], [...matchFields.entries()]);

  // Countdown fields remain experimental until pre-1.0 semantics settle; version & verdicts stay stable.
  assert.equal(resultFields.get("schemaVersion"), "@stable");
  assert.equal(resultFields.get("status"), "@stable");
  assert.equal(resultFields.get("asOf"), "@experimental");
  assert.equal(matchFields.get("event"), "@stable");
  assert.equal(matchFields.get("daysLeft"), "@experimental");
});
