"use client";

// Small per-device memory of the club app: the member's name, their signups (with the
// token to take them back) and, for organizers, the organizer code.

const NAME_KEY = "club:name";
const SIGNUPS_KEY = "club:signups";
const CODE_KEY = "club:organizer-code";

export interface OwnSignup {
  eventId: string;
  token: string;
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the app still works, it just forgets.
  }
}

export const clubStorage = {
  getName: () => read(NAME_KEY) ?? "",
  setName: (name: string) => write(NAME_KEY, name),
  getCode: () => read(CODE_KEY),
  setCode: (code: string | null) => write(CODE_KEY, code),
  getSignups(): Record<string, OwnSignup> {
    try {
      return JSON.parse(read(SIGNUPS_KEY) ?? "{}") as Record<string, OwnSignup>;
    } catch {
      return {};
    }
  },
  setSignups: (signups: Record<string, OwnSignup>) => write(SIGNUPS_KEY, JSON.stringify(signups)),
};
