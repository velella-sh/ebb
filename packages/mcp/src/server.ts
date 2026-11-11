import { upcomingResource } from "./resources/upcoming.js";
import { checkTool } from "./tools/check.js";
import { checkAllTool } from "./tools/check_all.js";
import { replacementForTool } from "./tools/replacement.js";
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

export const LATEST_PROTOCOL_VERSION = "2024-11-05";
export const SERVER_NAME = "@velella/ebb-mcp";
export const SERVER_VERSION = "0.1.0";

export class McpServer {
  private readonly info: McpServerInfo;
  private readonly capabilities: McpServerCapabilities;
  private readonly tools = new Map<string, McpTool>();
  private readonly resources = new Map<string, McpResource>();
  private initialized = false;

  constructor(options?: {
    name?: string;
    version?: string;
    capabilities?: McpServerCapabilities;
  }) {
    this.info = {
      name: options?.name ?? SERVER_NAME,
      version: options?.version ?? SERVER_VERSION,
    };
    this.capabilities = options?.capabilities ?? {
      tools: {},
      resources: {},
    };

    // Register built-in tools
    this.registerTool(checkTool);
    this.registerTool(checkAllTool);
    this.registerTool(replacementForTool);

    // Register built-in resources
    this.registerResource(upcomingResource);
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
    // Exact match or base uri without query params
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

    // Notifications have no id and must not produce a response
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
        const tools = Array.from(this.tools.values()).map((t) => t.definition);
        return { tools };
      }
      case "tools/call": {
        return this.handleToolCall(params);
      }
      case "resources/list": {
        const resources = Array.from(this.resources.values()).map((r) => r.definition);
        return { resources };
      }
      case "resources/read": {
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

    const args = typeof toolArgs === "object" && toolArgs !== null
      ? (toolArgs as Record<string, unknown>)
      : {};

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
