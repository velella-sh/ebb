import test from "node:test";
import assert from "node:assert/strict";
import { findArchivedSnapshot } from "../../tools/source-heal/archive.js";

test("findArchivedSnapshot finds snapshot and verifies date", async () => {
  const targetUrl = "https://example.com/dead";
  const deadline = "2026-05-01";

  const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    if (urlStr.includes("archive.org/wayback/available")) {
      return new Response(
        JSON.stringify({
          archived_snapshots: {
            closest: {
              available: true,
              url: "https://web.archive.org/web/20260401000000/https://example.com/dead",
              timestamp: "20260401000000",
              status: "200",
            },
          },
        }),
        { status: 200 },
      );
    }
    if (urlStr.includes("web.archive.org/web/")) {
      return new Response(`<html><body>End of life announced for May 1, 2026 (2026-05-01).</body></html>`, {
        status: 200,
      });
    }
    return new Response("Not found", { status: 404 });
  };

  const res = await findArchivedSnapshot(targetUrl, {
    fetchFn: mockFetch,
    deadline,
  });

  assert.equal(res.found, true);
  assert.equal(res.dateFound, true);
  assert.equal(res.archivedAt, "2026-04-01");
  assert.match(res.archiveUrl ?? "", /web\.archive\.org/);
});

test("findArchivedSnapshot handles missing snapshot", async () => {
  const targetUrl = "https://example.com/never-archived";
  const mockFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ archived_snapshots: {} }), { status: 200 });
  };

  const res = await findArchivedSnapshot(targetUrl, { fetchFn: mockFetch });
  assert.equal(res.found, false);
  assert.equal(res.dateFound, false);
});

test("findArchivedSnapshot rejects snapshot missing required date", async () => {
  const targetUrl = "https://example.com/different-page";
  const deadline = "2026-12-31";

  const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    if (urlStr.includes("archive.org/wayback/available")) {
      return new Response(
        JSON.stringify({
          archived_snapshots: {
            closest: {
              available: true,
              url: "https://web.archive.org/web/20250101000000/https://example.com/different-page",
              timestamp: "20250101000000",
              status: "200",
            },
          },
        }),
        { status: 200 },
      );
    }
    return new Response(`<html><body>Generic welcome page without any date.</body></html>`, { status: 200 });
  };

  const res = await findArchivedSnapshot(targetUrl, {
    fetchFn: mockFetch,
    deadline,
  });

  assert.equal(res.found, true);
  assert.equal(res.dateFound, false);
  assert.match(res.reason ?? "", /does not contain required deadline/);
});
