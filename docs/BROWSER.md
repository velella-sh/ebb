# Running Ebb in the Browser

Ebb runs in modern web browsers with **zero Node.js dependencies**, zero native bindings, and zero runtime polyfills.

All core evaluation logic (`check`, `checkAll`, `rulesFor`, `replacementFor`, `createEbb`) executes entirely client-side.

---

## Quick Start

### With a Modern Bundler (Vite, Webpack, esbuild, Rollup)

Install `@velella/ebb`:

```bash
npm install @velella/ebb
```

In your browser code, import as usual. Bundlers automatically select the `"browser"` condition defined in `package.json`:

```typescript
import { check, replacementFor } from "@velella/ebb";

const result = check("pkg:npm/request", "2.88.2");
console.log(result.status); // "deprecated"

const replacement = replacementFor("pkg:npm/node-sass", "9.0.0");
console.log(replacement); // "pkg:npm/sass"
```

---

## Data Loading Strategies

Ebb supports two data strategies in browser environments:

### 1. Bundled In-Memory Data (Default, 100% Offline)

By default, the browser entry point bundles lifecycle data in-memory:

- **Works Synchronously:** Synchronous `check()` calls work immediately without awaiting any network request.
- **Works Completely Offline:** Zero network requests are made.
- **Fast:** Instant O(1) in-memory lookups.
- **Bundle Size:** ~135 KB gzipped for all 25 bundled ecosystems combined.

### 2. Static API Fetch Loader (Ultra-Lightweight Bundle)

If you want to keep the initial client bundle as small as possible (~15 KB gzipped), configure Ebb to load lifecycle rules on demand over HTTP from the [Ebb Static API](static-api.md):

```typescript
import { check, createFetchLoader, setDataLoader, preload } from "@velella/ebb/browser";

// Configure fetch loader using official CDN or self-hosted API
setDataLoader(createFetchLoader({
  baseUrl: "https://velella.sh/ebb/api/v1",
}));

// Preload specific ecosystem(s) before evaluating
await preload(["npm"]);

// Synchronous check works once ecosystem data is loaded
const result = check("pkg:npm/request", "2.88.2");
```

### 3. Scoped Instances (`createEbb`)

When your web app only inspects specific ecosystems (e.g. npm packages), bundle only the data for those ecosystems:

```typescript
import { createEbb } from "@velella/ebb/create";
import npmData from "@velella/ebb/data/npm";

const ebb = createEbb({ ecosystems: [npmData] });
const result = ebb.check("pkg:npm/request", "2.88.2");
```

Tree-shaking ensures only the requested ecosystem code is included in your client bundle (~20 KB gzipped).

---

## Bundle Sizes

Measured with `esbuild --minify`:

| Target | Uncompressed | Gzipped |
| :--- | :--- | :--- |
| Core Engine + Fetch Loader | 42 KB | **~12 KB** |
| Scoped Single Ecosystem (`npm`) | 165 KB | **~24 KB** |
| Full Bundle (all 25 ecosystems) | 1.52 MB | **~135 KB** |

---

## Supported Browsers

Ebb is continuously tested against:

- **Chromium** (Google Chrome, Microsoft Edge, Brave, Opera)
- **Firefox**
- **WebKit** (Apple Safari, iOS Safari)

Browser tests run automatically in CI using Playwright.
