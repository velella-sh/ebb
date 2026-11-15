import type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  McpInitializeResult,
  McpResource,
  McpServerCapabilities,
  McpServerInfo,
  McpTool,
} from "./types.js";
import { readInstalledPackageMeta } from "./package-meta.js";

export const LATEST_PROTOCOL_VERSION = "2024-11-05";

const installed = readInstalledPackageMeta();
export const SERVER_NAME = installed.name;
/** Version reported in initialize; always taken from the installed package.json. */
export const SERVER_VERSION = installed.version;

export class McpServer {
  private readonly info: McpServerInfo;
  private readonly capabilities: McpServerCapabilities;
  private readonly tools = new Map<string, McpTool>();
  private readonly resources = new Map<string, McpResource>();
  private initialized = false;
  private builtinsPromise: Promise<void> | null = null;

  constructor(options?: {
    name?: string;
    version?: string;
    capabilities?: McpServerCapabilities;
  }) {
    const meta = readInstalledPackageMeta();
    this.info = {
      name: options?.name ?? meta.name,
      version: options?.version ?? meta.version,
    };
    this.capabilities = options?.capabilities ?? {
      tools: {},
      resources: {},
    };
  }

  /** Lazily load built-in tools/resources so initialize stays cheap. */
  private async ensureBuiltins(): Promise<void> {
    if (this.builtinsPromise) {
      await this.builtinsPromise;
      return;
    }
    this.builtinsPromise = (async () => {
      const [
        { upcomingResource },
        { checkTool },
        { checkAllTool },
        { diffTool },
        { replacementForTool },
        { sourcesTool },
        { pickVersionTool },
      ] = await Promise.all([
        import("./resources/upcoming.js"),
        import("./tools/check.js"),
        import("./tools/check_all.js"),
        import("./tools/diff.js"),
        import("./tools/replacement.js"),
        import("./tools/sources.js"),
        import("./tools/pick_version.js"),
      ]);
      this.registerTool(checkTool);
      this.registerTool(checkAllTool);
      this.registerTool(diffTool);
      this.registerTool(replacementForTool);
      this.registerTool(sourcesTool);
      this.registerTool(pickVersionTool);
      this.registerResource(upcomingResource);
    })();
    await this.builtinsPromise;
  }

  public registerTool(tool: McpTool): void {
    this.tools.set(tool.definition.name, tool);
  }

  public getTool(name: string): McpTool | undefined {
    return this.tools.get(name);
  }

  public registerResource(resource: McpResource): void {
    this.resources.set(resource.definition.uri, resource);
  }

  public getResource(uri: string): McpResource | undefined {
    if (this.resources.has(uri)) {
      return this.resources.get(uri);
    }
    const baseUri = uri.split("?")[0] ?? uri;
    return this.resources.get(baseUri);
  }

  public async handleMessage(raw: unknown): Promise<JsonRpcResponse | null> {
    if (typeof raw !== "object" || raw === null) {
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Request: expected object" },
      };
    }

    const msg = raw as Partial<JsonRpcRequest & JsonRpcNotification>;
    if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      return {
        jsonrpc: "2.0",
        id: typeof msg.id === "number" || typeof msg.id === "string" ? msg.id : null,
        error: { code: -32600, message: "Invalid Request: jsonrpc must be '2.0' and method must be a string" },
      };
    }

    const isNotification = msg.id === undefined || msg.id === null;

    if (isNotification) {
      this.handleNotification(msg.method, msg.params);
      return null;
    }

    const id = msg.id as string | number;
    try {
      const result = await this.handleMethod(msg.method, msg.params);
      return {
        jsonrpc: "2.0",
        id,
        result,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message,
        },
      };
    }
  }

  private handleNotification(method: string, _params: unknown): void {
    if (method === "notifications/initialized") {
      this.initialized = true;
    }
  }

  private async handleMethod(method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case "initialize": {
        const result: McpInitializeResult = {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: this.capabilities,
          serverInfo: this.info,
        };
        return result;
      }
      case "ping": {
        return {};
      }
      case "tools/list": {
        await this.ensureBuiltins();
        const tools = Array.from(this.tools.values()).map((t) => t.definition);
        return { tools };
      }
      case "tools/call": {
        await this.ensureBuiltins();
        return this.handleToolCall(params);
      }
      case "resources/list": {
        await this.ensureBuiltins();
        const resources = Array.from(this.resources.values()).map((r) => r.definition);
        return { resources };
      }
      case "resources/read": {
        await this.ensureBuiltins();
        return this.handleResourceRead(params);
      }
      default: {
        const error = new Error(`Method not found: ${method}`);
        // biome-ignore lint/suspicious/noExplicitAny: error code attachment
        (error as any).code = -32601;
        throw error;
      }
    }
  }

  private async handleToolCall(rawParams: unknown): Promise<unknown> {
    if (typeof rawParams !== "object" || rawParams === null) {
      return {
        content: [{ type: "text", text: "Error: params must be an object with name and arguments" }],
        isError: true,
      };
    }

    const { name, arguments: toolArgs } = rawParams as {
      name?: unknown;
      arguments?: unknown;
    };

    if (typeof name !== "string") {
      return {
        content: [{ type: "text", text: "Error: tool name must be a string" }],
        isError: true,
      };
    }

    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Error: Unknown tool "${name}"` }],
        isError: true,
      };
    }

    const args = typeof toolArgs === "object" && toolArgs !== null ? (toolArgs as Record<string, unknown>) : {};

    return await tool.handler(args);
  }

  private async handleResourceRead(rawParams: unknown): Promise<unknown> {
    if (typeof rawParams !== "object" || rawParams === null) {
      throw new Error("Invalid params: expected object with uri");
    }

    const { uri } = rawParams as { uri?: unknown };
    if (typeof uri !== "string") {
      throw new Error("Invalid params: uri must be a string");
    }

    const resource = this.getResource(uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    return await resource.handler(uri);
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}
