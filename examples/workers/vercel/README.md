# Ebb Vercel Edge Function Example

This example demonstrates deploying Ebb as an Edge Function on Vercel using the V8 Edge Runtime (`edge-light`).

## Local Development

```bash
vercel dev
```

Test requests:
```bash
curl "http://localhost:3000/api/check?purl=pkg:npm/request&version=2.88.2"
```

## Deployment

Deploy using the Vercel CLI:
```bash
vercel deploy --prod
```
