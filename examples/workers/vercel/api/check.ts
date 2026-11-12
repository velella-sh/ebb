import { check, checkAll, replacementFor } from "@velella/ebb";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "POST") {
    const items = (await request.json()) as Array<{ purl: string; version: string }>;
    const result = checkAll(items);
    return Response.json(result);
  }

  const purl = url.searchParams.get("purl");
  const version = url.searchParams.get("version");

  if (!purl || !version) {
    return Response.json(
      { error: "Pass 'purl' and 'version' query parameters, or POST a JSON array of components." },
      { status: 400 },
    );
  }

  const result = check(purl, version);
  const replacement = replacementFor(purl, version);

  return Response.json({
    ...result,
    replacement,
  });
}
