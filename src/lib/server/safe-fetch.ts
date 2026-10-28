import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Fetches user-supplied URLs (recipe pages, their photos) without letting them
// reach our own network: every hop of a redirect chain must resolve to a public
// address, and the body is cut off once it gets too large.

const MAX_REDIRECTS = 5;

export class BlockedUrlError extends Error {}

function ipv4ToNumber(address: string) {
  return address.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

const PRIVATE_V4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const value = ipv4ToNumber(address);
    return PRIVATE_V4_RANGES.some(([base, bits]) => {
      const size = 2 ** (32 - bits);
      const start = ipv4ToNumber(base);
      return value >= start && value < start + size;
    });
  }

  const v6 = address.toLowerCase();
  // IPv4-mapped (::ffff:10.0.0.1) inherits the IPv4 answer.
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);

  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    /^fe[89ab]/.test(v6) ||
    v6.startsWith("ff")
  );
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Protocol not allowed: ${url.protocol}`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((entry) => entry.address);

  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new BlockedUrlError(`Host not allowed: ${url.hostname}`);
  }
}

/**
 * fetch() for untrusted URLs. Follows up to five redirects itself, checking each
 * target, and reads at most `maxBytes` of the body.
 */
export async function safeFetch(
  input: string | URL,
  init: Omit<RequestInit, "redirect"> & { maxBytes: number },
): Promise<{ response: Response; body: Buffer }> {
  const { maxBytes, ...requestInit } = init;
  let url = new URL(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);

    const response = await fetch(url, { ...requestInit, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, body: Buffer.alloc(0) };
      url = new URL(location, url);
      continue;
    }

    if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
      throw new Error("Response too large");
    }

    return { response, body: await readLimited(response, maxBytes) };
  }

  throw new Error("Too many redirects");
}

async function readLimited(response: Response, maxBytes: number) {
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}
