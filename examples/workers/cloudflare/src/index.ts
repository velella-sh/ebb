import { check, checkAll, replacementFor, rulesFor } from "@velella/ebb";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", runtime: "cloudflare-workers" });
    }

    if (url.pathname === "/check") {
      const purl = url.searchParams.get("purl");
      const version = url.searchParams.get("version");
      if (!purl || !version) {
        return Response.json({ error: "Missing required 'purl' and 'version' query parameters." }, { status: 400 });
      }
      const result = check(purl, version);
      return Response.json(result);
    }

    if (url.pathname === "/check-all" && request.method === "POST") {
      const body = (await request.json()) as Array<{ purl: string; version: string }>;
      const result = checkAll(body);
      return Response.json(result);
    }

    if (url.pathname === "/replacement") {
      const purl = url.searchParams.get("purl");
      const version = url.searchParams.get("version") || "";
      if (!purl) {
        return Response.json({ error: "Missing required 'purl' query parameter." }, { status: 400 });
      }
      const replacement = replacementFor(purl, version);
      return Response.json({ purl, version, replacement });
    }

    if (url.pathname === "/rules") {
      const purl = url.searchParams.get("purl");
      if (!purl) {
        return Response.json({ error: "Missing required 'purl' query parameter." }, { status: 400 });
      }
      const rules = rulesFor(purl);
      return Response.json({ purl, count: rules.length, rules });
    }

    return new Response(
      "Ebb Cloudflare Worker.\n\nEndpoints:\n- GET /check?purl=...&version=...\n- POST /check-all\n- GET /replacement?purl=...\n- GET /rules?purl=...\n",
      { headers: { "content-type": "text/plain" } },
    );
  },
};
