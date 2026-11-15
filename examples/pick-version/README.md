# Which version to take

Prints the release lines Ebb knows for Node.js, Python, and the `request` package on 15 November 2026.

```bash
node --experimental-strip-types examples/pick-version/pick-version.ts
```

The script imports the built library in `dist/`. Run `npm run build` first. `request` has no recommendation: its only known line has already ended.
