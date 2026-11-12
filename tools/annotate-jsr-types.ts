import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * Prepends JSR @ts-self-types declarations to compiled JavaScript files in dist/src
 * to allow JSR to type-check without slow-type warnings and provide full JSR documentation.
 */
export function annotateJsrTypes(dir = "dist/src"): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      annotateJsrTypes(full);
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".js") &&
      !entry.name.endsWith(".map") &&
      entry.name !== "cli.js"
    ) {
      const dts = full.replace(/\.js$/, ".d.ts");
      if (existsSync(dts)) {
        const content = readFileSync(full, "utf8");
        if (!content.includes("@ts-self-types")) {
          const dtsName = `./${basename(dts)}`;
          writeFileSync(full, `/* @ts-self-types="${dtsName}" */\n${content}`);
        }
      }
    }
  }
}

annotateJsrTypes();
