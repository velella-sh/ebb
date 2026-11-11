export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown> | unknown[] | undefined;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown> | unknown[] | undefined;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpServerCapabilities {
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  logging?: Record<string, unknown>;
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpServerCapabilities;
  serverInfo: McpServerInfo;
}
