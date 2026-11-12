# Ebb Cloudflare Worker Example

This example demonstrates deploying Ebb as a Cloudflare Worker using the `workerd` runtime.

## Requirements

- Node.js >= 22
- Cloudflare Wrangler CLI (`npm install -g wrangler`)

## Development

```bash
# Run locally using workerd simulator
npm run dev
```

Test requests:
```bash
curl "http://localhost:8787/check?purl=pkg:npm/request&version=2.88.2"
```

## Deployment

```bash
npm run deploy
```

The bundle size is well under Cloudflare's 1 MB free tier limit (~135 KB compressed with all 25 ecosystems included).
