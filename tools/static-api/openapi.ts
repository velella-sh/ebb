import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface EndpointSpec {
  path: string;
  summary: string;
  description: string;
  example: string;
  responseType?: string;
  schemaRef?: string;
}

export const ENDPOINTS: EndpointSpec[] = [
  {
    path: "/meta.json",
    summary: "API metadata",
    description: "Catalog metadata: data version, package version, rule counts, and schema versions",
    example: "/meta.json",
    schemaRef: "#/components/schemas/metaDocument",
  },
  {
    path: "/{type}/{name}.json",
    summary: "Component lifecycle rules",
    description: "Lifecycle rules for a specific component",
    example: "/npm/request.json",
    schemaRef: "#/components/schemas/componentDocument",
  },
  {
    path: "/{type}/{namespace}/{name}.json",
    summary: "Namespaced component lifecycle rules",
    description: "Scoped or namespaced component",
    example: "/npm/@angular/core.json",
    schemaRef: "#/components/schemas/componentDocument",
  },
  {
    path: "/rules/{rule-id}.json",
    summary: "Single lifecycle rule",
    description: "Full lifecycle rule with evidence sources and provenance",
    example: "/rules/npm.package.request.deprecated.json",
    schemaRef: "#/components/schemas/ruleDocument",
  },
  {
    path: "/{ecosystem}.json",
    summary: "Ecosystem lifecycle rules",
    description: "All rules for a specific ecosystem",
    example: "/npm.json",
    schemaRef: "#/components/schemas/ecosystemDocument",
  },
  {
    path: "/ecosystems/{ecosystem}.json",
    summary: "Ecosystem alias",
    description: "Ecosystem alias",
    example: "/ecosystems/npm.json",
    schemaRef: "#/components/schemas/ecosystemDocument",
  },
  {
    path: "/all.json",
    summary: "All active lifecycle rules",
    description: "All active rules across all ecosystems",
    example: "/all.json",
    schemaRef: "#/components/schemas/allDocument",
  },
  {
    path: "/index.json",
    summary: "Global component catalog",
    description: "Global catalog mapping every component to its URL and content hash",
    example: "/index.json",
    schemaRef: "#/components/schemas/indexDocument",
  },
  {
    path: "/ecosystems.json",
    summary: "Catalog of ecosystems",
    description: "Catalog of all ecosystems with rule and component counts",
    example: "/ecosystems.json",
    schemaRef: "#/components/schemas/ecosystemsDocument",
  },
  {
    path: "/upcoming.json",
    summary: "Upcoming deadlines",
    description: "Scheduled deprecations and end-of-life dates, sorted by deadline",
    example: "/upcoming.json",
    schemaRef: "#/components/schemas/upcomingDocument",
  },
  {
    path: "/recent.json",
    summary: "Recently updated rules",
    description: "Most recently reviewed and updated rules, sorted by date",
    example: "/recent.json",
    schemaRef: "#/components/schemas/recentDocument",
  },
  {
    path: "/search-index.json",
    summary: "Component search index",
    description: "Compact prefix search index for fast component autocomplete",
    example: "/search-index.json",
    schemaRef: "#/components/schemas/searchIndexDocument",
  },
  {
    path: "/releases.json",
    summary: "Release log history",
    description: "History of signed data releases with version, date, digest, and change counts",
    example: "/releases.json",
    schemaRef: "#/components/schemas/releasesDocument",
  },
  {
    path: "/openapi.json",
    summary: "OpenAPI description",
    description: "OpenAPI 3.1 specification describing the static API",
    example: "/openapi.json",
  },
  {
    path: "/calendar/all.ics",
    summary: "All upcoming deadlines calendar",
    description: "Deadlines from the last 30 days and the next 24 months",
    example: "/calendar/all.ics",
    responseType: "text/calendar",
  },
  {
    path: "/calendar/{ecosystem}.ics",
    summary: "Ecosystem deadlines calendar",
    description: "That window for one ecosystem",
    example: "/calendar/npm.ics",
    responseType: "text/calendar",
  },
  {
    path: "/calendar/{type}/{name}.ics",
    summary: "Component deadlines calendar",
    description: "One component, only when a deadline is still ahead",
    example: "/calendar/generic/nodejs.ics",
    responseType: "text/calendar",
  },
  {
    path: "/renovate/{type}/{name}.json",
    summary: "Renovate custom datasource feed",
    description: "Release lines and deprecation flags formatted for Renovate custom datasources",
    example: "/renovate/generic/nodejs.json",
  },
];

export interface GenerateOpenApiOptions {
  root?: string;
  baseUrl?: string;
  version?: string;
}

export async function generateOpenApi(options?: GenerateOpenApiOptions): Promise<Record<string, unknown>> {
  const root = resolve(options?.root ?? ".");
  let baseUrl = options?.baseUrl ?? "https://velella.sh/ebb/api/v1";
  while (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }
  let version = options?.version;
  if (!version) {
    try {
      const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { version: string };
      version = pkg.version;
    } catch {
      version = "0.2.1";
    }
  }

  let staticApiSchema: Record<string, unknown> = {};
  try {
    staticApiSchema = JSON.parse(await readFile(join(root, "schemas/static-api.v1.schema.json"), "utf8"));
  } catch {
    // Leave schemas empty if file unreadable
  }

  const paths: Record<string, unknown> = {};

  for (const ep of ENDPOINTS) {
    const paramMatches = ep.path.match(/\{([^}]+)\}/g) ?? [];
    const parameters = paramMatches.map((m) => {
      const name = m.slice(1, -1);
      return {
        name,
        in: "path",
        required: true,
        schema: { type: "string" },
        description: `The ${name} parameter`,
      };
    });

    const responseContent: Record<string, unknown> = {};
    const mediaType = ep.responseType ?? "application/json";
    responseContent[mediaType] = {
      schema: ep.schemaRef ? { $ref: ep.schemaRef } : { type: "object" },
    };

    paths[ep.path] = {
      get: {
        summary: ep.summary,
        description: ep.description,
        ...(parameters.length > 0 ? { parameters } : {}),
        responses: {
          "200": {
            description: "Successful response",
            content: responseContent,
          },
          "404": {
            description: "Resource not found",
          },
        },
      },
    };
  }

  const schemas = (staticApiSchema.$defs as Record<string, unknown>) ?? {};

  return {
    openapi: "3.1.0",
    info: {
      title: "Ebb Static Lifecycle API",
      version,
      description: "Public static zero-dependency JSON API for component and ecosystem lifecycle rules.",
    },
    servers: [
      {
        url: baseUrl,
        description: "Static API endpoint base",
      },
    ],
    paths,
    components: {
      schemas,
    },
  };
}
