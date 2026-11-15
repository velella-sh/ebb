import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { validateRegistryV2 } from "../src/registry.js";
import { versContains } from "../src/vers/index.js";

// Compiled to dist/tests/, two levels below the package root.
const packageRoot = join(import.meta.dirname, "..", "..");

async function rules() {
  return validateRegistryV2(JSON.parse(await readFile(join(packageRoot, "registry/dotnet.json"), "utf8"))).rules;
}

test("the .NET registry has eighteen valid rules, each citing an authoritative source", async () => {
  const all = await rules();
  assert.equal(all.length, 18);
  for (const rule of all) {
    assert.ok(
      rule.sources.every((source) => source.url.startsWith("https://")),
      rule.id,
    );
    assert.ok(
      rule.sources.some((source) =>
        /^https:\/\/(?:dotnet\.microsoft\.com\/platform\/support\/policy\/dotnet-core|dotnetcli\.blob\.core\.windows\.net\/dotnet\/release-metadata\/releases-index\.json|www\.nuget\.org\/packages\/(?:WindowsAzure\.Storage|Microsoft\.Azure\.(?:DocumentDB|ServiceBus|Storage\.Blob)))$/.test(
          source.url,
        ),
      ),
      `${rule.id} cites the .NET policy, the releases index, or the package's NuGet page`,
    );
  }
});

test("each runtime rule covers its own release line, runtimes and SDKs alike, and nothing else", async () => {
  const runtime = (await rules()).filter((rule) => rule.purl === "pkg:generic/dotnet");
  assert.deepEqual(runtime.map((rule) => [rule.id, rule.deadline, rule.event]).sort(), [
    ["dotnet.runtime.end-of-support-1.0", "2019-06-27", "end-of-support"],
    ["dotnet.runtime.end-of-support-1.1", "2019-06-27", "end-of-support"],
    ["dotnet.runtime.end-of-support-10.0", "2028-11-14", "scheduled-end-of-life"],
    ["dotnet.runtime.end-of-support-11.0", "2028-11-14", "scheduled-end-of-life"],
    ["dotnet.runtime.end-of-support-2.0", "2018-10-01", "end-of-support"],
    ["dotnet.runtime.end-of-support-2.1", "2021-08-21", "end-of-support"],
    ["dotnet.runtime.end-of-support-2.2", "2019-12-23", "end-of-support"],
    ["dotnet.runtime.end-of-support-3.0", "2020-03-03", "end-of-support"],
    ["dotnet.runtime.end-of-support-3.1", "2022-12-13", "end-of-support"],
    ["dotnet.runtime.end-of-support-5.0", "2022-05-10", "end-of-support"],
    ["dotnet.runtime.end-of-support-6.0", "2024-11-12", "end-of-support"],
    ["dotnet.runtime.end-of-support-7.0", "2024-05-14", "end-of-support"],
    ["dotnet.runtime.end-of-support-8.0", "2026-11-10", "end-of-support"],
    ["dotnet.runtime.end-of-support-9.0", "2026-11-10", "end-of-support"],
  ]);
  const affected = (version: string) =>
    runtime
      .filter((rule) => versContains(rule.vers, version))
      .map((rule) => rule.id.replace(/^dotnet\.runtime\.(?:scheduled-)?end-of-support-/, ""));
  for (const [version, lines] of [
    ["3.1.0", ["3.1"]],
    ["3.1.426", ["3.1"]],
    ["5.0.0", ["5.0"]],
    ["6.0.400", ["6.0"]],
    ["7.0.20", ["7.0"]],
    ["8.0.0", ["8.0"]],
    ["8.0.404", ["8.0"]],
    ["9.0.100", ["9.0"]],
    ["10.0.100", ["10.0"]],
    ["11.0.0", ["11.0"]],
    ["2.1.818", ["2.1"]],
    ["2.2.402", ["2.2"]],
    ["3.0.103", ["3.0"]],
    ["1.0.16", ["1.0"]],
    ["1.1.13", ["1.1"]],
    ["2.0.9", ["2.0"]],
    ["4.0.0", []],
  ] as const) {
    assert.deepEqual(affected(version), lines, version);
  }
  for (const rule of runtime) {
    if (rule.event === "scheduled-end-of-life") {
      assert.equal(rule.severity, "low", rule.id);
      continue;
    }
    // 8.0 and 9.0 reached their end-of-support date on 2026-11-10 and were promoted from scheduled (decision 0010).
    assert.equal(rule.event, "end-of-support", rule.id);
    assert.equal(rule.severity, "high", rule.id);
  }
});

test("the package rule matches every version of WindowsAzure.Storage, including four-part versions", async () => {
  const rule = (await rules()).find((candidate) => candidate.purl === "pkg:nuget/WindowsAzure.Storage")!;
  assert.equal(rule.event, "deprecated");
  assert.equal(rule.deadline, "2023-03-31");
  for (const version of ["1.0.0.0", "9.3.3", "9.4.0-preview"]) assert.ok(versContains(rule.vers, version), version);
});

test("each deprecated NuGet package rule matches every version and names its replacement", async () => {
  const packages = (await rules()).filter((rule) => rule.purl.startsWith("pkg:nuget/"));
  assert.deepEqual(packages.map((rule) => [rule.purl, rule.deadline, rule.replacement]).sort(), [
    ["pkg:nuget/Microsoft.Azure.DocumentDB", "2023-03-31", "Microsoft.Azure.Cosmos"],
    ["pkg:nuget/Microsoft.Azure.ServiceBus", "2026-09-30", "Azure.Messaging.ServiceBus"],
    ["pkg:nuget/Microsoft.Azure.Storage.Blob", "2023-03-31", "Azure.Storage.Blobs"],
    [
      "pkg:nuget/WindowsAzure.Storage",
      "2023-03-31",
      "Azure.Storage.Blobs, Azure.Storage.Queues, Azure.Storage.Files.Shares, or Azure.Data.Tables, with Azure.Storage.Common",
    ],
  ]);
  for (const rule of packages) {
    assert.equal(rule.event, "deprecated", rule.id);
    assert.ok(versContains(rule.vers, "1.0.0"), rule.id);
    assert.ok(rule.usage && rule.usage.length > 0, `${rule.id} lists the source usage that a migration touches`);
  }
});
