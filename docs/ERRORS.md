# Ebb Error Codes

Every error Ebb throws on purpose is an `EbbError` with a stable `code` field. Callers can branch on the code without matching message strings.

```ts
import { check } from "@velella/ebb";

try {
  const result = await check("pkg:npm/INVALID", "1.0.0");
} catch (err) {
  if (err instanceof EbbError) {
    switch (err.code) {
      case "invalid-purl": /* bad package URL */ break;
      case "data-unavailable": /* offline or not yet downloaded */ break;
    }
  }
}
```

## Codes

### `invalid-purl`

**Thrown by:** `parsePurl` / `check` / `checkAll` / `rulesFor` / `replacementFor`

**Cause:** The input string is not a valid [PURL](https://github.com/package-url/purl-spec). Common reasons: missing `pkg:` scheme, missing type, missing name, duplicate qualifier key, bad percent-encoding.

```ts
import { check } from "@velella/ebb";

try {
  await check("invalid-purl", "1.0.0");
} catch (err) {
  if (err instanceof EbbError && err.code === "invalid-purl") {
    console.error("Invalid package URL provided:", err.message);
  }
}
```

**Fix:** Validate the PURL before calling Ebb, or catch this code and surface the error to the user.

---

### `invalid-version`

**Thrown by:** `check` / `checkAll`

**Cause:** The version string is not valid for the scheme of the given package type (for example, a non-semver string where a semver string is required).

```ts
import { check } from "@velella/ebb";

try {
  await check("pkg:npm/express", "not-a-valid-version");
} catch (err) {
  if (err instanceof EbbError && err.code === "invalid-version") {
    console.error("Invalid version string for package scheme:", err.message);
  }
}
```

**Fix:** Normalise or validate the version string before calling Ebb.

---

### `invalid-data-version`

**Thrown by:** `update` / `useData`

**Cause:** The requested data bundle version string does not match the expected format (for example, `2026.10.01`).

**Fix:** Use a version string from `listDataVersions()` or omit the version to use the latest.

---

### `data-unavailable`

**Thrown by:** `check` / `checkAll` / `rulesFor` / `replacementFor` (when no local data has been downloaded yet)

**Cause:** No data bundle has been downloaded to the local cache and no bundled data is available for the current query.

```ts
import { check } from "@velella/ebb";

try {
  await check("pkg:npm/express", "4.18.2");
} catch (err) {
  if (err instanceof EbbError && err.code === "data-unavailable") {
    console.error("Offline or cache empty; run update() first.");
  }
}
```

**Fix:** Call `update()` once before querying, or use a bundled-data import (`@velella/ebb/bundled-rules`).

---

### `data-update-failed`

**Thrown by:** `update`

**Cause:** The download, signature verification, or JSON parsing of the remote data bundle failed. The existing local cache (if any) is kept intact.

**Fix:** Check the network connection and try again. If the error persists, file a bug with the full error message.

---

### `invalid-date`

**Thrown by:** `daysUntil` (via `check` / `checkAll`) and `makeForecast`

**Cause:** A date string passed as `asOf` or `today` is not in `YYYY-MM-DD` ISO format.

**Fix:** Use a correctly formatted ISO date string such as `new Date().toISOString().slice(0, 10)`.

---

### `package-file-not-found`

**Thrown by:** `findPackageFile` / `findPackageFileSync`

**Cause:** Ebb could not locate a required file (for example, a registry JSON) by walking up the directory tree from the calling module. This usually means the package was not installed correctly or the compiled code is in an unexpected location.

**Fix:** Ensure `@velella/ebb` is installed as a dependency and that `dist/src/` exists. If you are bundling Ebb, make sure the registry and data files are included alongside the bundle.

---

### `internal`

**Thrown by:** `required` / `fromLookupProduct` / internal parse helpers

**Cause:** An assertion that should never be false in correct usage was violated. This is a bug in Ebb or in a caller that passes data in an undocumented shape.

**Fix:** Please [file a bug](https://github.com/velella-sh/ebb/issues/new) with the full error message and a minimal reproduction.

---

## All throws in `src/`

| File | Line | Class | Code | Message (abbreviated) |
|---|---|---|---|---|
| `src/purl.ts` | multiple | `PurlError` | `invalid-purl` | Various purl parse errors |
| `src/vers/semver.ts` | 120, 125 | `VersError` | `invalid-version` | `Invalid semver version "…"` |
| `src/vers/maven.ts` | 242 | `VersError` | `invalid-version` | `Invalid Maven version "…"` |
| `src/vers/pep440.ts` | 44 | `VersError` | `invalid-version` | `Invalid PEP 440 version "…"` |
| `src/vers/gem.ts` | 12 | `VersError` | `invalid-version` | `Invalid RubyGems version "…"` |
| `src/vers/nuget.ts` | 15 | `VersError` | `invalid-version` | `Invalid NuGet version "…"` |
| `src/vers/schemes.ts` | 15 | `VersError` | `invalid-version` | `Invalid intdot version "…"` |
| `src/data-bundle.ts` | multiple | `DataBundleError` | `invalid-data-version` | Various bundle errors |
| `src/data-update.ts` | multiple | `DataUpdateError` | `data-update-failed` | Various download/verify errors |
| `src/data-source.ts` | multiple | `DataPinError` | `data-unavailable` | Various source errors |
| `src/result.ts` | 92 | `EbbError` | `invalid-date` | `"…" is not a date (YYYY-MM-DD).` |
| `src/forecast.ts` | 113 | `EbbError` | `invalid-date` | `"…" is not a date (YYYY-MM-DD).` |
| `src/package-files.ts` | 24, 42 | `EbbError` | `package-file-not-found` | `Ebb package file not found: …` |
| `src/required.ts` | 6 | `EbbError` | `internal` | `missing …` |
| `src/result-compat.ts` | 86, 93 | `EbbError` | `internal` | `Cannot map …` |
| `src/data-update.ts` | 203 | `DataUpdateError` | `data-update-failed` | `The release list is not valid JSON.` |
