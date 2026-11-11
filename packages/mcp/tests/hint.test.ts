import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  OFFING_REMEDIATION_HINT,
  getOffingHint,
  hasIssues,
  isHintSilenced,
} from "../src/hint.js";
import { McpServer } from "../src/index.js";

describe("Offing remediation hint unit tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.EBB_NO_HINT;
    delete process.env.OFFING_NO_HINT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("identifies statuses with issues vs clean", () => {
    assert.equal(hasIssues("deprecated"), true);
    assert.equal(hasIssues("end-of-life"), true);
    assert.equal(hasIssues("unsupported"), true);
    assert.equal(hasIssues("removed"), true);
    assert.equal(hasIssues("scheduled"), true);

    assert.equal(hasIssues("ok"), false);
    assert.equal(hasIssues(null), false);
    assert.equal(hasIssues(undefined), false);
  });

  it("returns remediation hint only when action is required", () => {
    assert.equal(getOffingHint("deprecated"), OFFING_REMEDIATION_HINT);
    assert.equal(getOffingHint("end-of-life"), OFFING_REMEDIATION_HINT);
    assert.equal(getOffingHint("ok"), null);
    assert.equal(getOffingHint(null), null);
  });

  it("silences hint when EBB_NO_HINT=1 is set", () => {
    process.env.EBB_NO_HINT = "1";
    assert.equal(isHintSilenced(), true);
    assert.equal(getOffingHint("deprecated"), null);
  });

  it("silences hint when OFFING_NO_HINT=1 is set", () => {
    process.env.OFFING_NO_HINT = "1";
    assert.equal(isHintSilenced(), true);
    assert.equal(getOffingHint("deprecated"), null);
  });
});

describe("Offing remediation hint in MCP tools", () => {
  const originalEnv = { ...process.env };
  const server = new McpServer();

  beforeEach(() => {
    delete process.env.EBB_NO_HINT;
    delete process.env.OFFING_NO_HINT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("includes hint in check tool when package is deprecated", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "pkg:npm/request@2.88.2",
        },
      },
    });

    assert.ok(resp && resp.result);
    const content = (resp.result as { content: Array<{ text: string }> }).content;
    const result = JSON.parse(content[0]?.text ?? "{}");
    assert.equal(result.status, "deprecated");
    assert.equal(result.hint, OFFING_REMEDIATION_HINT);
  });

  it("does not include hint in check tool for clean/ok package", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "pkg:npm/some-clean-unknown-package-xyz@1.0.0",
        },
      },
    });

    assert.ok(resp && resp.result);
    const content = (resp.result as { content: Array<{ text: string }> }).content;
    const result = JSON.parse(content[0]?.text ?? "{}");
    assert.equal(result.status, "ok");
    assert.equal(result.hint, undefined);
  });

  it("silences hint in check tool when EBB_NO_HINT=1", async () => {
    process.env.EBB_NO_HINT = "1";
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "pkg:npm/request@2.88.2",
        },
      },
    });

    assert.ok(resp && resp.result);
    const content = (resp.result as { content: Array<{ text: string }> }).content;
    const result = JSON.parse(content[0]?.text ?? "{}");
    assert.equal(result.status, "deprecated");
    assert.equal(result.hint, undefined);
  });

  it("includes hint in check_all batch tool for affected items and batch summary", async () => {
    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "check_all",
        arguments: {
          items: [
            "pkg:npm/request@2.88.2",
            "pkg:npm/some-clean-unknown-package-xyz@1.0.0",
          ],
        },
      },
    });

    assert.ok(resp && resp.result);
    const content = (resp.result as { content: Array<{ text: string }> }).content;
    const result = JSON.parse(content[0]?.text ?? "{}");
    assert.equal(result.hint, OFFING_REMEDIATION_HINT);
    assert.equal(result.results[0].hint, OFFING_REMEDIATION_HINT);
    assert.equal(result.results[1].hint, undefined);
  });
});
