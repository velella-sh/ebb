---
title: Framework runtime compatibility
description: Find framework releases with vendor-documented or registry-declared compatibility for your runtime.
layout: doc
permalink: /runtime-support/
---

Import `@velella/ebb/compat` in Node.js to inspect the bundled tables offline. The [MCP tool](/mcp/#runtime_support) exposes the same lookup. The static API exposes [documented compatibility](https://velella.sh/ebb/api/v1/compat/runtime-support.json) and [declared metadata](https://velella.sh/ebb/api/v1/compat/runtime-support-declared.json). Both tables use the [compatibility table format](/formats/compat.v1/).

Documented rows come from a project's compatibility pages or release notes. Declared rows come from `engines.node` on npm and `Requires-Python` on PyPI and evaluate stable runtime versions. Registry metadata can describe installation requirements without testing every version it admits. `requirementsOf(purl, version)` shows both kinds. A documented row takes priority when the records cover the same subject version and runtime. An `unknown` result means the available evidence cannot answer the query.

## Documented coverage

| Runtime PURL | Frameworks and libraries with documented rows |
| --- | --- |
| `pkg:generic/nodejs` | Angular, Express, NestJS, Next.js, Nuxt, Vite |
| `pkg:generic/electron-nodejs` | Electron's embedded Node.js |
| `pkg:generic/python` | Django, FastAPI, Flask, NumPy, pandas, SciPy |
| `pkg:generic/java` | Jakarta EE, Micronaut, Quarkus, Spring Boot |
| `pkg:generic/kotlin-jvm-target` | Kotlin compiler JVM bytecode targets |
| `pkg:generic/ruby` | Rails |
| `pkg:generic/php` | Laravel, Symfony |
| `pkg:generic/dotnet` | ASP.NET Core and Entity Framework Core |

The rows cover specific releases or evidenced lines. Electron's embedded runtime is version-specific. Kotlin rows record the selectable bytecode targets for each listed compiler release. Where Java documentation gives only a baseline, the row records that baseline. Look at the row's source and notes for the applicable patch versions, test coverage, or separate tooling requirements.

## Examples

`firstSupporting(purl, runtimePurl, runtimeVersion)` returns the lowest eligible version across both evidence kinds. A historical release or prerelease can be first when its registry declaration accepts the runtime. The object includes the source and evidence kind in `row`. To verify a particular framework release, call `supports(purl, version, runtimePurl, runtimeVersion)`.

```js
import assert from "node:assert/strict";
import { firstSupporting, supports } from "@velella/ebb/compat";

const examples = [
  ["pkg:npm/%40angular/core", "pkg:generic/nodejs", "24.15.0", "12.0.2", "declared"],
  ["pkg:npm/electron", "pkg:generic/electron-nodejs", "24.22.3", "43.8.13"],
  ["pkg:pypi/django", "pkg:generic/python", "3.13", "2.0a1", "declared"],
  ["pkg:maven/org.springframework.boot/spring-boot", "pkg:generic/java", "27", "4.0.10"],
  ["pkg:maven/org.jetbrains.kotlin/kotlin-compiler", "pkg:generic/kotlin-jvm-target", "25", "2.3.0"],
  ["pkg:gem/rails", "pkg:generic/ruby", "3.1.0", "7.0"],
  ["pkg:composer/laravel/framework", "pkg:generic/php", "8.5.0", "12.0.0"],
  ["pkg:nuget/microsoft.aspnetcore.app.ref", "pkg:generic/dotnet", "10.0.0", "10.0.0"],
];

for (const [purl, runtime, version, expected, kind = "documented"] of examples) {
  const result = firstSupporting(purl, runtime, version);
  assert.equal(result.status, "supported");
  assert.equal(result.version, expected);
  assert.equal(result.row.kind, kind);
}

const django = "pkg:pypi/django";
const python = "pkg:generic/python";
assert.equal(supports(django, "5.1.2", python, "3.13").status, "not-supported");
assert.equal(supports(django, "5.1.3", python, "3.13").row.kind, "documented");
```

Django’s PyPI declaration for 2.0a1 allows Python 3.13 on paper. For the Django 5.1 line, the official Python 3.13 support boundary is 5.1.3. [Django installation FAQ](https://docs.djangoproject.com/en/6.1/faq/install/#what-python-version-can-i-use-with-django)

## Refresh declared metadata

From an Ebb checkout, build the tools and run the runtime support importer.

```sh
npm run build
node dist/tools/importers/run.js runtime-support --out runtime-support-drafts.json
```

The command reads all npm and PyPI subjects in the canonical lifecycle registry and adds the documented frameworks from those registries. The output contains a reviewable `table` and `notes`. Review the registry evidence, then copy the `table` object into `registry/tables/runtime-support-declared.compat.json`. Reports list packages whose registry entry disappeared and count releases skipped for missing, conflicting, or unsupported metadata. The importer groups exact versions with the same requirement, so releases without evidence stay uncovered.
