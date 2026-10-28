import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOwnRecipeImage, safeHttpUrl, toSourceUrl, withSafeLinks } from "@/lib/safe-links";

describe("safeHttpUrl", () => {
  it("keeps http and https links", () => {
    expect(safeHttpUrl("https://www.chefkoch.de/rezepte/1")).toBe("https://www.chefkoch.de/rezepte/1");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it.each(["javascript://example.com/%0Aalert(1)", "javascript:alert(1)", "data://x.de/text/html,hi", "kein link", ""])(
    "drops %j",
    (url) => expect(safeHttpUrl(url)).toBeNull(),
  );
});

describe("toSourceUrl", () => {
  it("adds https to bare domains and drops other schemes", () => {
    expect(toSourceUrl(" chefkoch.de/rezepte/1 ")).toBe("https://chefkoch.de/rezepte/1");
    expect(toSourceUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(toSourceUrl("javascript://x.de/%0Aalert(1)")).toBeNull();
    expect(toSourceUrl("")).toBeNull();
  });
});

describe("isOwnRecipeImage", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co"));
  afterEach(() => vi.unstubAllEnvs());

  const own = "https://abc.supabase.co/storage/v1/object/public/recipe-images/user/foto.jpg";

  it("accepts images from our bucket only", () => {
    expect(isOwnRecipeImage(own)).toBe(true);
    expect(isOwnRecipeImage("https://evil.supabase.co/storage/v1/object/public/recipe-images/x.jpg")).toBe(false);
    expect(isOwnRecipeImage("https://tracker.example/pixel.gif")).toBe(false);
    expect(isOwnRecipeImage(null)).toBe(false);
  });

  it("clears unsafe links on a recipe", () => {
    expect(
      withSafeLinks({ name: "R", image_url: "https://tracker.example/p.gif", source_url: "javascript://x.de/%0Aalert(1)" }),
    ).toEqual({ name: "R", image_url: null, source_url: null });
    expect(withSafeLinks({ image_url: own, source_url: "https://example.com/" })).toEqual({
      image_url: own,
      source_url: "https://example.com/",
    });
  });
});
