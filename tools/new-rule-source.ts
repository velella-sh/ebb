import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";

const reserved = new BlockList();
for (const [base, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) {
  reserved.addSubnet(base, prefix);
}

export function evidenceUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    isIP(url.hostname) !== 0 ||
    /(?:^|\.)(?:local|localhost|internal|home|test|invalid|example)$/.test(url.hostname)
  ) {
    throw new Error("Enter a public HTTPS source on its standard port.");
  }
  url.hash = "";
  return url;
}

interface Response {
  status: number;
  location: string | undefined;
  text: string;
}

export function publicAddress(address: string): boolean {
  return isIP(address) === 4 && !reserved.check(address);
}

async function readPage(location: URL): Promise<Response> {
  const { address } = await lookup(location.hostname, { family: 4 });
  if (!publicAddress(address)) throw new Error("The source does not resolve to a public address.");
  // Keep the TLS hostname while connecting to the exact address that passed the check.
  return new Promise((resolve, reject) => {
    const req = request(
      location,
      {
        agent: false,
        family: 4,
        signal: AbortSignal.timeout(8_000),
        lookup: (_host, _options, callback) => callback(null, address, 4),
        headers: { "user-agent": "Ebb evidence check (+https://github.com/velella-sh/ebb)" },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let length = 0;
        response.on("data", (chunk: Buffer) => {
          length += chunk.length;
          if (length > 1024 * 1024) response.destroy(new Error("Source exceeds the 1 MiB inspection limit."));
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            location: response.headers.location,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function readEvidence(value: string): Promise<string> {
  let url = evidenceUrl(value);
  for (let hop = 0; hop < 4; hop++) {
    const response = await readPage(url);
    if (response.status >= 200 && response.status < 300) return response.text;
    if (response.status < 300 || response.status >= 400 || !response.location)
      throw new Error(`Source returned HTTP ${response.status}.`);
    url = evidenceUrl(new URL(response.location, url).href);
  }
  throw new Error("Source exceeded the redirect limit.");
}

export async function requestArchive(value: string): Promise<string> {
  const source = evidenceUrl(value);
  if (source.search) return "skip (URL has a query string)";
  const response = await readPage(new URL(`https://web.archive.org/save/${encodeURI(source.href)}`));
  return response.status >= 200 && response.status < 400
    ? `requested (HTTP ${response.status})`
    : `request failed (HTTP ${response.status})`;
}

export type ReadEvidence = (url: string) => Promise<string>;

export async function safeRead(url: string, read: ReadEvidence): Promise<string | undefined> {
  try {
    return await read(url);
  } catch {
    return undefined;
  }
}
