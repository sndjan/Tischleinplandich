import { afterEach, describe, expect, it, vi } from "vitest";
import { isPrivateAddress, publicLookup, safeFetch } from "@/lib/server/safe-fetch";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("undici", async (importOriginal) => ({ ...(await importOriginal<typeof import("undici")>()), fetch: fetchMock }));

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])(
    "blocks %s",
    (address) => expect(isPrivateAddress(address)).toBe(true),
  );

  // Other spellings of internal addresses: hex IPv4-mapped, IPv4-compatible,
  // NAT64, 6to4, fully written out.
  it.each([
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "0:0:0:0:0:ffff:7f00:1",
    "::127.0.0.1",
    "::",
    "64:ff9b::7f00:1",
    "64:ff9b::10.0.0.1",
    "2002:7f00:1::1",
    "0000:0000:0000:0000:0000:0000:0000:0001",
    "fc00::1",
    "ff02::1",
    "not-an-address",
  ])("blocks %s", (address) => expect(isPrivateAddress(address)).toBe(true));

  it.each(["8.8.8.8", "172.32.0.1", "2a00:1450:4001::1", "::ffff:8.8.8.8", "::ffff:808:808", "64:ff9b::808:808", "2002:808:808::1"])(
    "allows %s",
    (address) => expect(isPrivateAddress(address)).toBe(false),
  );
});

describe("publicLookup", () => {
  const resolve = (all: boolean) =>
    new Promise<unknown>((done) => publicLookup("localhost", { all }, (error) => done(error)));

  it("refuses names that resolve to an internal address when connecting", async () => {
    expect(await resolve(true)).toBeInstanceOf(Error);
    expect(await resolve(false)).toBeInstanceOf(Error);
  });
});

describe("safeFetch", () => {
  it("refuses internal hosts before sending anything", async () => {
    await expect(safeFetch("http://127.0.0.1/", { maxBytes: 10 })).rejects.toThrow("Host not allowed");
    await expect(safeFetch("http://[::1]/", { maxBytes: 10 })).rejects.toThrow("Host not allowed");
    await expect(safeFetch("http://[::ffff:127.0.0.1]/", { maxBytes: 10 })).rejects.toThrow("Host not allowed");
    await expect(safeFetch("http://localhost/", { maxBytes: 10 })).rejects.toThrow("Host not allowed");
    await expect(safeFetch("file:///etc/passwd", { maxBytes: 10 })).rejects.toThrow("Protocol not allowed");
  });

  afterEach(() => fetchMock.mockReset());

  it("checks every redirect target", async () => {
    fetchMock.mockImplementation(
      async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }),
    );
    await expect(safeFetch("http://93.184.216.34/", { maxBytes: 10 })).rejects.toThrow("Host not allowed");
  });

  it("stops reading bodies over the limit", async () => {
    fetchMock.mockImplementation(async () => new Response("x".repeat(20)));
    await expect(safeFetch("http://93.184.216.34/", { maxBytes: 10 })).rejects.toThrow("too large");
  });
});
