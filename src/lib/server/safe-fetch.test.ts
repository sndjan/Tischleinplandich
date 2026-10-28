import { afterEach, describe, expect, it, vi } from "vitest";
import { isPrivateAddress, safeFetch } from "@/lib/server/safe-fetch";

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])(
    "blocks %s",
    (address) => expect(isPrivateAddress(address)).toBe(true),
  );

  it.each(["8.8.8.8", "172.32.0.1", "2a00:1450:4001::1", "::ffff:8.8.8.8"])("allows %s", (address) =>
    expect(isPrivateAddress(address)).toBe(false),
  );
});

describe("safeFetch", () => {
  it("refuses internal hosts before sending anything", async () => {
    await expect(safeFetch("http://127.0.0.1/", { maxBytes: 10 })).rejects.toThrow("Host not allowed");
    await expect(safeFetch("http://[::1]/", { maxBytes: 10 })).rejects.toThrow("Host not allowed");
    await expect(safeFetch("http://localhost/", { maxBytes: 10 })).rejects.toThrow("Host not allowed");
    await expect(safeFetch("file:///etc/passwd", { maxBytes: 10 })).rejects.toThrow("Protocol not allowed");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("checks every redirect target", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } })),
    );
    await expect(safeFetch("http://93.184.216.34/", { maxBytes: 10 })).rejects.toThrow("Host not allowed");
  });

  it("stops reading bodies over the limit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(20))));
    await expect(safeFetch("http://93.184.216.34/", { maxBytes: 10 })).rejects.toThrow("too large");
  });
});
