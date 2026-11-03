import { describe, expect, it } from "vitest";
import {
  buildEventNotification,
  CreateEventSchema,
  formatEventTime,
  initials,
  localDateTimeToIso,
  signupStatus,
  splitEvents,
} from "./events";

describe("localDateTimeToIso", () => {
  it("reads the form's date and time as local time", () => {
    const iso = localDateTimeToIso("2026-11-14", "09:30");
    expect(iso).not.toBeNull();
    const date = new Date(iso!);
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([
      2026, 10, 14, 9, 30,
    ]);
  });

  it("rejects incomplete input", () => {
    expect(localDateTimeToIso("", "09:30")).toBeNull();
    expect(localDateTimeToIso("2026-11-14", "")).toBeNull();
  });
});

describe("splitEvents", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("keeps running events upcoming and sorts both lists", () => {
    const events = [
      { id: "later", starts_at: "2026-11-20T08:00:00Z", ends_at: null },
      { id: "old", starts_at: "2026-10-01T08:00:00Z", ends_at: "2026-10-01T12:00:00Z" },
      { id: "running", starts_at: "2026-11-10T10:00:00Z", ends_at: "2026-11-10T14:00:00Z" },
      { id: "older", starts_at: "2026-09-01T08:00:00Z", ends_at: null },
    ];
    const { upcoming, past } = splitEvents(events, now);
    expect(upcoming.map((e) => e.id)).toEqual(["running", "later"]);
    expect(past.map((e) => e.id)).toEqual(["old", "older"]);
  });

  it("treats an event without end time as upcoming for the rest of its day", () => {
    const morning = new Date(2026, 10, 10, 8, 0).toISOString();
    const evening = new Date(2026, 10, 10, 20, 0);
    const { upcoming } = splitEvents([{ starts_at: morning, ends_at: null }], evening);
    expect(upcoming).toHaveLength(1);
  });
});

describe("signupStatus", () => {
  it("counts people when no number is needed", () => {
    expect(signupStatus(0, null).label).toBe("Noch niemand dabei");
    expect(signupStatus(1, null).label).toBe("1 Person dabei");
    expect(signupStatus(3, null)).toMatchObject({ label: "3 Personen dabei", progress: null, full: false });
  });

  it("shows what is missing and caps the progress", () => {
    expect(signupStatus(2, 6)).toMatchObject({ label: "2 von 6 · noch 4 gesucht", full: false });
    expect(signupStatus(7, 6)).toMatchObject({ progress: 1, full: true });
  });
});

describe("CreateEventSchema", () => {
  const base = { title: "Platzpflege", startsAt: "2026-11-14T08:00:00.000Z" };

  it("fills defaults", () => {
    expect(CreateEventSchema.parse(base)).toMatchObject({
      description: "",
      location: "",
      endsAt: null,
      helpersNeeded: null,
      notify: true,
    });
  });

  it("rejects an end before the start and an empty title", () => {
    expect(CreateEventSchema.safeParse({ ...base, endsAt: "2026-11-14T07:00:00.000Z" }).success).toBe(false);
    expect(CreateEventSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
  });
});

describe("notification text", () => {
  it("names the event, the time and the place", () => {
    const notification = buildEventNotification({
      id: "abc",
      title: "Hecke schneiden",
      starts_at: "2026-11-14T08:00:00.000Z",
      ends_at: "2026-11-14T12:00:00.000Z",
      location: "Vereinsheim",
    });
    expect(notification.title).toBe("Neuer Arbeitseinsatz: Hecke schneiden");
    expect(notification.body).toBe("Samstag, 14. November, 09:00 – 13:00 Uhr · Vereinsheim");
    expect(notification.url).toBe("/verein#einsatz-abc");
  });

  it("formats an open end", () => {
    expect(formatEventTime("2026-11-14T08:00:00.000Z", null)).toBe("09:00 Uhr");
  });
});

describe("initials", () => {
  it("takes first and last name", () => {
    expect(initials("Anna Maria Müller")).toBe("AM");
    expect(initials("jan")).toBe("J");
    expect(initials("  ")).toBe("?");
  });
});
