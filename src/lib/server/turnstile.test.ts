import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "@/lib/server/turnstile";

describe("verifyTurnstile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("lets everything through while no secret is set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect(await verifyTurnstile(undefined, null)).toBe(true);
  });

  it("lets nothing through when only the site key is set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await verifyTurnstile("token", null)).toBe(false);
    vi.restoreAllMocks();
  });

  it("requires a token once a secret is set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await verifyTurnstile(undefined, null)).toBe(false);
  });

  it("follows Cloudflare's answer", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile("token", "1.2.3.4")).toBe(true);

    fetchMock.mockImplementationOnce(async () => Response.json({ success: false }));
    expect(await verifyTurnstile("token", null)).toBe(false);
  });
});
