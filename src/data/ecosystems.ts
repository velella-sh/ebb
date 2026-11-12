/**
 * Canonical list of ecosystems bundled with Ebb.
 */

export const BUNDLED_ECOSYSTEMS = [
  "android",
  "ci-images",
  "container",
  "cpp",
  "dart",
  "database",
  "deno",
  "dotnet",
  "elixir",
  "github-actions",
  "go",
  "java",
  "kubernetes",
  "nodejs",
  "npm",
  "osv",
  "php",
  "python",
  "ruby",
  "rust",
  "scala",
  "serverless",
  "shell",
  "swift",
  "terraform",
] as const;

export type BundledEcosystem = (typeof BUNDLED_ECOSYSTEMS)[number];
