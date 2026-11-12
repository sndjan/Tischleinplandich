import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

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

function isPrivateV4(value: number) {
  return PRIVATE_V4_RANGES.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    const start = ipv4ToNumber(base);
    return value >= start && value < start + size;
  });
}

/**
 * The eight 16-bit groups of an IPv6 address, or null when it isn't one. Working
 * on the numbers means every spelling of an address gets the same answer
 * ("::ffff:127.0.0.1" and "::ffff:7f00:1" are the same host).
 */
function parseIpv6(address: string): number[] | null {
  let text = address.split("%")[0];

  // A dotted IPv4 tail stands for the last two groups.
  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    if (isIP(tail[1]) !== 4) return null;
    const value = ipv4ToNumber(tail[1]);
    text = `${text.slice(0, -tail[1].length)}${Math.floor(value / 65536).toString(16)}:${(value % 65536).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const toGroups = (part: string) => (part ? part.split(":").map((group) => parseInt(group, 16)) : []);
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 0 : missing !== 0) return null;

  const groups = [...head, ...new Array<number>(Math.max(missing, 0)).fill(0), ...rest];
  return groups.length === 8 && groups.every((group) => group >= 0 && group <= 0xffff) ? groups : null;
}

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateV4(ipv4ToNumber(address));

  const groups = parseIpv6(address.toLowerCase());
  // Not an address we understand: refuse rather than guess.
  if (!groups) return true;

  const embeddedV4 = (index: number) => isPrivateV4(groups[index] * 65536 + groups[index + 1]);
  const startsWith = (...prefix: number[]) => prefix.every((group, index) => groups[index] === group);

  // "::" and "::1", and the old IPv4-compatible form "::a.b.c.d".
  if (startsWith(0, 0, 0, 0, 0, 0)) return groups[6] === 0 && groups[7] <= 1 ? true : embeddedV4(6);
  // Addresses that carry an IPv4 one inherit its answer: IPv4-mapped, NAT64, 6to4.
  if (startsWith(0, 0, 0, 0, 0, 0xffff)) return embeddedV4(6);
  if (startsWith(0x64, 0xff9b)) return groups[2] !== 0 || embeddedV4(6);
  if (startsWith(0x2002)) return embeddedV4(1);

  return (
    (groups[0] & 0xfe00) === 0xfc00 || // unique local
    (groups[0] & 0xffc0) === 0xfe80 || // link-local
    (groups[0] & 0xff00) === 0xff00 || // multicast
    startsWith(0x2001, 0) || // Teredo
    startsWith(0x2001, 0xdb8) // documentation
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
 * The DNS lookup of the connection itself. The check above resolves the name
 * once, but a hostile DNS server can answer differently a moment later, so the
 * addresses that are actually connected to are checked here again.
 */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, result) => {
    const addresses = (result ?? []) as LookupAddress[];

    if (!error && (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address)))) {
      error = new BlockedUrlError(`Host not allowed: ${hostname}`);
    }
    if (error) {
      callback(error, "", 4);
    } else if (options.all) {
      callback(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
};

const agent = new Agent({ connect: { lookup: publicLookup } });

type SafeResponse = { ok: boolean; status: number; headers: { get(name: string): string | null } };

/**
 * fetch() for untrusted URLs. Follows up to five redirects itself, checking each
 * target, and reads at most `maxBytes` of the body.
 */
export async function safeFetch(
  input: string | URL,
  init: { headers?: Record<string, string>; signal?: AbortSignal; maxBytes: number },
): Promise<{ response: SafeResponse; body: Buffer }> {
  const { maxBytes, ...requestInit } = init;
  let url = new URL(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);

    const response = await undiciFetch(url, { ...requestInit, redirect: "manual", dispatcher: agent });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      // Frees the connection; the body of a redirect is never read.
      await response.body?.cancel();
      if (!location) return { response, body: Buffer.alloc(0) };
      url = new URL(location, url);
      continue;
    }

    if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
      await response.body?.cancel();
      throw new Error("Response too large");
    }

    return { response, body: await readLimited(response.body, maxBytes) };
  }

  throw new Error("Too many redirects");
}

async function readLimited(stream: AsyncIterable<Uint8Array> | null, maxBytes: number) {
  if (!stream) return Buffer.alloc(0);

  const chunks: Uint8Array[] = [];
  let total = 0;

  // Leaving the loop early (the throw) cancels the stream.
  for await (const chunk of stream) {
    total += chunk.byteLength;
    if (total > maxBytes) throw new Error("Response too large");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}
