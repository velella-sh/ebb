import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { McpServer } from "../src/index.js";
import { loadUpcomingEvents } from "../src/resources/upcoming.js";
import type { McpResourceResult } from "../src/types.js";

describe("loadUpcomingEvents", () => {
  it("loads future events and excludes expired ones relative to asOf", () => {
    const today = "2026-11-11";
    const result = loadUpcomingEvents({ asOf: today });

    assert.equal(result.asOf, today);
    assert.ok(result.count > 0);
    assert.equal(result.events.length, result.count);

    for (const event of result.events) {
      assert.ok(event.deadline >= today, `Event ${event.ruleId} has deadline ${event.deadline} before ${today}`);
      assert.ok(event.daysLeft >= 0, `Event ${event.ruleId} has negative daysLeft ${event.daysLeft}`);
      assert.ok(event.ruleId.length > 0);
      assert.ok(event.purl.length > 0);
    }
  });

  it("sorts earliest deadline first", () => {
    const result = loadUpcomingEvents({ asOf: "2026-11-11" });
    for (let i = 1; i < result.events.length; i++) {
      const prev = result.events[i - 1]!;
      const curr = result.events[i]!;
      assert.ok(
        prev.deadline <= curr.deadline,
        `Expected ${prev.deadline} <= ${curr.deadline}`,
      );
    }
  });
});

describe("MCP upcoming resource", () => {
  const server = new McpServer();

  it("lists upcoming resource in resources/list", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "resources/list",
    });

    assert.ok(resp);
    const result = resp.result as { resources: Array<{ uri: string; name: string }> };
    assert.ok(Array.isArray(result.resources));
    const upcomingDef = result.resources.find((r) => r.uri === "ebb://upcoming");
    assert.ok(upcomingDef);
    assert.equal(upcomingDef.name, "Upcoming software end-of-life and deprecations");
  });

  it("reads upcoming resource via resources/read", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "resources/read",
      params: {
        uri: "ebb://upcoming",
      },
    });

    assert.ok(resp);
    const result = resp.result as McpResourceResult;
    assert.ok(Array.isArray(result.contents));
    assert.equal(result.contents.length, 1);
    assert.equal(result.contents[0]?.uri, "ebb://upcoming");
    assert.equal(result.contents[0]?.mimeType, "application/json");

    const parsed = JSON.parse(result.contents[0]?.text ?? "{}");
    assert.ok(parsed.asOf);
    assert.ok(typeof parsed.count === "number");
    assert.ok(Array.isArray(parsed.events));
  });

  it("supports query parameter asOf in URI", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "resources/read",
      params: {
        uri: "ebb://upcoming?asOf=2027-06-01",
      },
    });

    assert.ok(resp);
    const result = resp.result as McpResourceResult;
    const parsed = JSON.parse(result.contents[0]?.text ?? "{}");
    assert.equal(parsed.asOf, "2027-06-01");
    for (const ev of parsed.events) {
      assert.ok(ev.deadline >= "2027-06-01");
    }
  });

  it("returns error on reading unknown resource URI", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "resources/read",
      params: {
        uri: "ebb://unknown-resource-uri",
      },
    });

    assert.ok(resp);
    assert.ok(resp.error);
    assert.ok(resp.error.message.includes("Resource not found"));
  });
});
