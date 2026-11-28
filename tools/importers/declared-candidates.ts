export interface DeclaredCandidate {
  readonly ecosystem: "npm" | "pypi";
  readonly name: string;
  readonly reason: string;
  readonly githubRepositoryId?: number;
  readonly declarationPath?: string;
}

// Maintainers review submitted candidates before adding them here.
const reviewed: readonly DeclaredCandidate[] = [
  {
    ecosystem: "npm",
    name: "@velella/ebb",
    reason: "Ebb checks its own published metadata.",
    githubRepositoryId: 1450650180,
  },
  { ecosystem: "npm", name: "typescript", reason: "The TypeScript compiler builds Ebb and is widely used across npm." },
  { ecosystem: "pypi", name: "pip", reason: "PyPA recommends pip as the standard installer for PyPI projects." },
];

// The initial inventory includes every npm and PyPI identity with a checked-in Ebb rule.
// Keep these names sorted and record the reason for new candidates in the reviewed list.
const ruledPackages = {
  npm: [
    "@angular/core",
    "@hapi/joi",
    "@humanwhocodes/config-array",
    "@humanwhocodes/object-schema",
    "@npmcli/move-file",
    "@nuxt/types",
    "@nuxt/typescript-build",
    "@types/diff",
    "@types/dotenv",
    "@types/emoji-regex",
    "@types/form-data",
    "@types/glob",
    "@types/koa-helmet",
    "@types/koa-useragent",
    "@types/pako",
    "@types/react-virtualized-auto-sizer",
    "@types/react-window",
    "@types/refractor",
    "@types/sanitize-filename",
    "@types/sequelize",
    "@types/socket.io-client",
    "abab",
    "are-we-there-yet",
    "babel-eslint",
    "babel-preset-es2015",
    "boom",
    "cryptiles",
    "crypto-js",
    "domexception",
    "eslint-plugin-nuxt",
    "figgy-pudding",
    "fstream",
    "gauge",
    "gulp-util",
    "har-validator",
    "i18next-parser",
    "inflight",
    "istanbul",
    "jade",
    "karma-phantomjs-launcher",
    "koa-router",
    "left-pad",
    "lodash.get",
    "lodash.isequal",
    "natives",
    "next",
    "node-pre-gyp",
    "node-sass",
    "nomnom",
    "npmlog",
    "osenv",
    "popper.js",
    "protractor",
    "q",
    "querystring",
    "react-beautiful-dnd",
    "react-native",
    "read-package-json",
    "request",
    "request-promise",
    "request-promise-native",
    "resolve-url",
    "rollup-plugin-babel",
    "rollup-plugin-terser",
    "sntp",
    "socket.io-redis",
    "source-map-url",
    "sourcemap-codec",
    "stable",
    "tslint",
    "uglify-es",
    "vue",
    "vue2-script-setup-transform",
    "w3c-hr-time",
  ],
  pypi: [
    "agentops-toolkit",
    "aiohttp-valera-validator",
    "api-shield",
    "apisec-code-bolt",
    "argparse",
    "asyncio-requests",
    "batchnotebook",
    "cmip-ref",
    "datacommons",
    "distribute",
    "django",
    "django-celery",
    "django-nose",
    "enum",
    "ghops",
    "goobook",
    "google-cloud",
    "headroom-cli",
    "imagej",
    "ipaddr",
    "llama-index-experimental",
    "mondobrain",
    "multimodal-timesfm",
    "nose",
    "opennms-api-wrapper",
    "pathlib",
    "pep8",
    "pil",
    "poetry-version-plugin",
    "pycrypto",
    "pyinj",
    "pytest-runner",
    "saroku",
    "seofleet-cli",
    "sklearn",
    "superlinked",
    "superlinked-server",
    "typing",
    "vsdeband",
    "vsscale",
  ],
} as const;

const byName = new Map<string, DeclaredCandidate>();
for (const ecosystem of ["npm", "pypi"] as const) {
  for (const name of ruledPackages[ecosystem]) {
    byName.set(`${ecosystem}:${name}`, { ecosystem, name, reason: "Has a lifecycle rule in the Ebb registry." });
  }
}
for (const candidate of reviewed) byName.set(`${candidate.ecosystem}:${candidate.name}`, candidate);

export const DECLARED_CANDIDATES: readonly DeclaredCandidate[] = [
  reviewed[0]!,
  ...[...byName.keys()]
    .sort()
    .filter((key) => key !== "npm:@velella/ebb")
    .map((key) => byName.get(key)!),
];
