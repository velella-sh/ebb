import assert from "node:assert/strict";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { after, before, describe, it } from "node:test";
import { McpServer } from "../../src/mcp/index.js";

function blockNetwork() {
  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpGet = http.get;
  const originalHttpsRequest = https.request;
  const originalHttpsGet = https.get;
  const originalNetConnect = net.connect;
  const originalNetCreateConnection = net.createConnection;
  const originalSocketConnect = net.Socket.prototype.connect;
  const originalDnsLookup = dns.lookup;
  const originalDnsResolve = dns.resolve;
  const originalDnsPromisesLookup = dns.promises.lookup;
  const originalDnsPromisesResolve = dns.promises.resolve;

  const throwNetworkError = (name: string) => {
    throw new Error(`Offline violation: network entry point "${name}" was called`);
  };

  globalThis.fetch = (() => throwNetworkError("fetch")) as unknown as typeof fetch;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  http.request = (() => throwNetworkError("http.request")) as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  http.get = (() => throwNetworkError("http.get")) as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  https.request = (() => throwNetworkError("https.request")) as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  https.get = (() => throwNetworkError("https.get")) as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  net.connect = (() => throwNetworkError("net.connect")) as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  net.createConnection = (() => throwNetworkError("net.createConnection")) as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  net.Socket.prototype.connect = function () {
    throwNetworkError("net.Socket.prototype.connect");
  } as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  dns.lookup = (() => throwNetworkError("dns.lookup")) as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  dns.resolve = (() => throwNetworkError("dns.resolve")) as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  dns.promises.lookup = (() => Promise.reject(new Error("Offline violation: dns.promises.lookup"))) as any;
  // biome-ignore lint/suspicious/noExplicitAny: monkey-patching for tests
  dns.promises.resolve = (() => Promise.reject(new Error("Offline violation: dns.promises.resolve"))) as any;

  return function restore() {
    globalThis.fetch = originalFetch;
    http.request = originalHttpRequest;
    http.get = originalHttpGet;
    https.request = originalHttpsRequest;
    https.get = originalHttpsGet;
    net.connect = originalNetConnect;
    net.createConnection = originalNetCreateConnection;
    net.Socket.prototype.connect = originalSocketConnect;
    dns.lookup = originalDnsLookup;
    dns.resolve = originalDnsResolve;
    dns.promises.lookup = originalDnsPromisesLookup;
    dns.promises.resolve = originalDnsPromisesResolve;
  };
}

describe("offline-4: MCP server makes no network requests", () => {
  let restoreNetwork: () => void;
  const server = new McpServer();

  before(() => {
    restoreNetwork = blockNetwork();
  });

  after(() => {
    restoreNetwork();
  });

  const toolArguments: Record<string, Record<string, unknown>> = {
    check: { purl: "pkg:npm/express@4.18.2" },
    check_all: { items: ["pkg:npm/express@4.18.2"] },
    check_install: { command: "npm install express@4.18.2" },
    diff: {},
    pick_version: { purl: "node", as_of: "2026-11-15" },
    predict_eol: { purl: "pkg:generic/golang", version: "1.26.0" },
    replacement_for: { purl: "pkg:npm/request", version: "2.88.2" },
    runtime_support: {
      purl: "pkg:pypi/django",
      version: "5.1.3",
      runtimePurl: "pkg:generic/python",
      runtimeVersion: "3.13",
    },
    sources_of: { ruleId: "npm.package.request.deprecated" },
    upcoming: { within: "90d" },
  };

  it("lists tools without network access", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    assert.ok(resp && resp.result);
    const tools = (resp.result as { tools: Array<{ name: string }> }).tools;
    assert.ok(tools.length > 0);
  });

  it("calls every registered tool without network access", async () => {
    const listResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    const tools = (listResp?.result as { tools: Array<{ name: string }> })?.tools ?? [];
    assert.ok(tools.length >= 9);

    let callId = 10;
    for (const tool of tools) {
      const args = toolArguments[tool.name] ?? {};
      const callResp = await server.handleMessage({
        jsonrpc: "2.0",
        id: callId++,
        method: "tools/call",
        params: {
          name: tool.name,
          arguments: args,
        },
      });
      assert.ok(callResp, `Tool ${tool.name} returned a response`);
      assert.equal(callResp.id, callId - 1);
      assert.ok(callResp.result, `Tool ${tool.name} execution succeeded without error`);
    }
  });

  it("lists and reads resources without network access", async () => {
    const listResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 50,
      method: "resources/list",
    });
    assert.ok(listResp && listResp.result);
    const resources = (listResp.result as { resources: Array<{ uri: string }> }).resources;
    for (const res of resources) {
      const readResp = await server.handleMessage({
        jsonrpc: "2.0",
        id: 51,
        method: "resources/read",
        params: { uri: res.uri },
      });
      assert.ok(readResp && readResp.result);
    }
  });
});
