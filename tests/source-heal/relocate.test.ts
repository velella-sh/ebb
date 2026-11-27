import test from "node:test";
import assert from "node:assert/strict";
import { findRelocatedSource } from "../../tools/source-heal/relocate.js";

test("findRelocatedSource detects http redirect with valid date", async () => {
  const oldUrl = "https://example.com/old-doc";
  const newUrl = "https://example.com/new-doc";
  const deadline = "2026-06-30";

  const mockFetch: typeof fetch = async () => {
    return {
      ok: true,
      url: newUrl,
      text: async () => `Documentation moved: EOL is 2026-06-30.`,
    } as unknown as Response;
  };

  const res = await findRelocatedSource(oldUrl, {
    fetchFn: mockFetch,
    deadline,
  });

  assert.equal(res.relocated, true);
  assert.equal(res.newUrl, newUrl);
  assert.equal(res.method, "http-redirect");
  assert.equal(res.dateFound, true);
});

test("findRelocatedSource detects GitHub repository rename/transfer", async () => {
  const oldUrl = "https://github.com/old-org/my-action/blob/v1/action.yml";
  const deadline = "2026-08-15";

  const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    if (urlStr.includes("api.github.com/repos/old-org/my-action")) {
      return new Response(JSON.stringify({ full_name: "new-org/my-action" }), { status: 200 });
    }
    if (urlStr.includes("api.github.com/repos/new-org/my-action/contents/action.yml")) {
      const content = Buffer.from("name: Action\ndescription: EOL is 2026-08-15\nruns: node20\n").toString("base64");
      return new Response(JSON.stringify({ encoding: "base64", content }), { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  };

  const res = await findRelocatedSource(oldUrl, {
    fetchFn: mockFetch,
    deadline,
  });

  assert.equal(res.relocated, true);
  assert.equal(res.newUrl, "https://github.com/new-org/my-action/blob/v1/action.yml");
  assert.equal(res.method, "github-repo-redirect");
  assert.equal(res.dateFound, true);
});

test("findRelocatedSource rejects candidate when date is missing", async () => {
  const oldUrl = "https://example.com/old";
  const deadline = "2027-01-01";

  const mockFetch: typeof fetch = async () => {
    return {
      ok: true,
      url: "https://example.com/new",
      text: async () => `Nothing about any dates here`,
    } as unknown as Response;
  };

  const res = await findRelocatedSource(oldUrl, {
    fetchFn: mockFetch,
    deadline,
  });

  assert.equal(res.relocated, false);
  assert.equal(res.dateFound, false);
});
