import { describe, expect, it } from "vitest";
import {
  formatMemberNames,
  getActiveHousehold,
  getDefaultServings,
  householdErrorMessage,
  isInviteToken,
  parseHouseholds,
  type Household,
} from "./households";

const raw = {
  active_household_id: "shared-1",
  households: [
    {
      id: "personal",
      name: null,
      is_personal: true,
      role: "owner",
      default_servings: null,
      members: [{ user_id: "me", display_name: "Jan", role: "owner", joined_at: "2026-01-01" }],
    },
    {
      id: "shared-1",
      name: "WG",
      is_personal: false,
      role: "member",
      default_servings: null,
      members: [
        { user_id: "anna", display_name: "Anna", role: "owner", joined_at: "2026-01-01" },
        { user_id: "me", display_name: "Jan", role: "member", joined_at: "2026-02-01" },
      ],
    },
    { name: "missing id" },
  ],
};

describe("parseHouseholds", () => {
  it("reads households and members and skips malformed entries", () => {
    const data = parseHouseholds(raw);
    expect(data.ready).toBe(true);
    expect(data.households.map((household) => household.id)).toEqual(["personal", "shared-1"]);
    expect(data.households[1].members[0]).toEqual({
      userId: "anna",
      displayName: "Anna",
      role: "owner",
      joinedAt: "2026-01-01",
    });
    expect(data.activeHouseholdId).toBe("shared-1");
  });

  it("treats a missing result as no households", () => {
    expect(parseHouseholds(null)).toEqual({ ready: true, households: [], activeHouseholdId: null });
  });

  it("reads the shared list settings, with defaults before migration 031", () => {
    const data = parseHouseholds({
      households: [{ ...raw.households[1], shopping_hide_basics: false, shopping_section_order: ["dairy", 3] }],
    });
    expect(data.households[0].shoppingHideBasics).toBe(false);
    expect(data.households[0].shoppingSectionOrder).toEqual(["dairy"]);
    expect(parseHouseholds(raw).households[0].shoppingHideBasics).toBe(true);
  });

  it("keeps a stored number of people", () => {
    const data = parseHouseholds({ households: [{ ...raw.households[1], default_servings: "3" }] });
    expect(data.households[0].defaultServings).toBe(3);
  });
});

describe("getActiveHousehold", () => {
  it("returns the stored active household", () => {
    expect(getActiveHousehold(parseHouseholds(raw))?.id).toBe("shared-1");
  });

  it("falls back to the personal household when the active one is gone", () => {
    const data = parseHouseholds({ ...raw, active_household_id: "left-it" });
    expect(getActiveHousehold(data)?.id).toBe("personal");
  });

  it("is null before the migration", () => {
    expect(getActiveHousehold({ ready: false, households: [], activeHouseholdId: null })).toBeNull();
  });
});

describe("getDefaultServings", () => {
  const shared = parseHouseholds(raw).households[1] as Household;

  it("is one portion alone", () => {
    expect(getDefaultServings(null)).toBe(1);
    expect(getDefaultServings(parseHouseholds(raw).households[0])).toBe(1);
  });

  it("uses the member count of a shared household", () => {
    expect(getDefaultServings(shared)).toBe(2);
  });

  it("prefers the household's own number of people", () => {
    expect(getDefaultServings({ ...shared, defaultServings: 4 })).toBe(4);
  });
});

describe("formatMemberNames", () => {
  it("joins names the German way", () => {
    expect(formatMemberNames(["Anna"])).toBe("Anna");
    expect(formatMemberNames(["Anna", "Ben"])).toBe("Anna und Ben");
    expect(formatMemberNames(["Anna", "Ben", null])).toBe("Anna, Ben und Jemand");
    expect(formatMemberNames(["A", "B", "C", "D", "E"])).toBe("A, B, C und 2 weitere");
  });
});

describe("householdErrorMessage", () => {
  it("maps the reasons raised by the database", () => {
    expect(householdErrorMessage({ message: "household_full" })).toContain("voll");
    expect(householdErrorMessage({ message: "invite_invalid" })).toContain("abgelaufen");
    expect(householdErrorMessage(new Error("boom"))).toContain("nicht geklappt");
  });
});

describe("isInviteToken", () => {
  it("accepts generated tokens only", () => {
    expect(isInviteToken("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isInviteToken("short")).toBe(false);
    expect(isInviteToken("../../etc/passwd/aaaaaaaaaaaa")).toBe(false);
  });
});
