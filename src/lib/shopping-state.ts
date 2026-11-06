import type { ShoppingMarkKind } from "@/types/database";
import type { ShoppingExtra } from "./shopping-list";

export type { ShoppingMarkKind };

// An item put on the list by hand; it stays from week to week until removed.
export type ShoppingCustomItem = { id: string; label: string; amount?: string };

/**
 * Everything about one week's shopping list besides the planned meals: what is
 * checked or removed, recipes left off, items added by hand and the settings.
 */
export type ShoppingState = {
  checked: string[];
  removed: string[];
  excludedRecipeIds: string[];
  customItems: ShoppingCustomItem[];
  extras: ShoppingExtra[];
  hideBasics: boolean;
  sectionOrder: string[];
};

export const EMPTY_SHOPPING_STATE: ShoppingState = {
  checked: [],
  removed: [],
  excludedRecipeIds: [],
  customItems: [],
  extras: [],
  hideBasics: true,
  sectionOrder: [],
};

/**
 * A change to the list. Changes are applied to the screen at once and sent to
 * the database in order, also later when the device was offline; each one can
 * be sent twice without harm.
 */
export type ShoppingOp =
  | { type: "mark"; kind: ShoppingMarkKind; key: string; on: boolean }
  | { type: "add-custom"; item: ShoppingCustomItem }
  | { type: "add-extra"; extra: ShoppingExtra }
  // Custom items and extras share one table, so one removal fits both.
  | { type: "remove-item"; id: string }
  | { type: "settings"; hideBasics?: boolean; sectionOrder?: string[] };

const MARK_FIELDS: Record<ShoppingMarkKind, "checked" | "removed" | "excludedRecipeIds"> = {
  checked: "checked",
  removed: "removed",
  excluded_recipe: "excludedRecipeIds",
};

/**
 * The list as it looks once the given changes have reached the database.
 */
export function applyShoppingOps(state: ShoppingState, ops: ShoppingOp[]): ShoppingState {
  let next = state;

  for (const op of ops) {
    switch (op.type) {
      case "mark": {
        const field = MARK_FIELDS[op.kind];
        const has = next[field].includes(op.key);
        if (has === op.on) break;
        next = {
          ...next,
          [field]: op.on ? [...next[field], op.key] : next[field].filter((key) => key !== op.key),
        };
        break;
      }
      case "add-custom":
        if (next.customItems.some((item) => item.id === op.item.id)) break;
        next = { ...next, customItems: [...next.customItems, op.item] };
        break;
      case "add-extra":
        if (next.extras.some((extra) => extra.id === op.extra.id)) break;
        next = { ...next, extras: [...next.extras, op.extra] };
        break;
      case "remove-item":
        next = {
          ...next,
          customItems: next.customItems.filter((item) => item.id !== op.id),
          extras: next.extras.filter((extra) => extra.id !== op.id),
        };
        break;
      case "settings":
        next = {
          ...next,
          ...(op.hideBasics !== undefined && { hideBasics: op.hideBasics }),
          ...(op.sectionOrder !== undefined && { sectionOrder: op.sectionOrder }),
        };
        break;
    }
  }

  return next;
}

// Limits of migration 031, applied before sending so a long entry can't block
// the queue of changes behind it.
export const CUSTOM_LABEL_MAX = 200;
export const CUSTOM_AMOUNT_MAX = 50;
export const ITEM_KEY_MAX = 300;

export function cleanCustomItem(item: ShoppingCustomItem): ShoppingCustomItem | null {
  const label = item.label.trim().slice(0, CUSTOM_LABEL_MAX).trim();
  if (!label) return null;
  const amount = item.amount?.trim().slice(0, CUSTOM_AMOUNT_MAX).trim();
  return { id: item.id, label, ...(amount && { amount }) };
}

// The browser storage the list used before it moved into the database.
export const LEGACY_PREFIX = "weekly-meal-planner:shopping-list:";
const LEGACY_CHECKED = `${LEGACY_PREFIX}checked-items`;
const LEGACY_REMOVED = `${LEGACY_PREFIX}removed-items`;
const LEGACY_CUSTOM = `${LEGACY_PREFIX}custom-items`;
const LEGACY_HIDE_BASICS = `${LEGACY_PREFIX}hide-basics`;
const LEGACY_SECTION_ORDER = `${LEGACY_PREFIX}section-order`;
const LEGACY_WEEK = `${LEGACY_PREFIX}week:`;

export const legacyKeys = {
  checked: (weekKey: string) => `${LEGACY_CHECKED}:${weekKey}`,
  removed: (weekKey: string) => `${LEGACY_REMOVED}:${weekKey}`,
  week: (weekKey: string) => `${LEGACY_WEEK}${weekKey}`,
  // Checks from before lists were kept per week; they belong to the current week.
  unscopedChecked: LEGACY_CHECKED,
  custom: LEGACY_CUSTOM,
  hideBasics: LEGACY_HIDE_BASICS,
  sectionOrder: LEGACY_SECTION_ORDER,
};

const WEEK_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parse = (raw: string | null): unknown => {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];

export function parseCustomItems(value: unknown): ShoppingCustomItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry?.id !== "string" || typeof entry?.label !== "string") return [];
    const item = cleanCustomItem({ id: entry.id, label: entry.label, amount: typeof entry.amount === "string" ? entry.amount : undefined });
    return item ? [item] : [];
  });
}

export function parseExtras(value: unknown): ShoppingExtra[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry?.id !== "string" || typeof entry?.recipeName !== "string") return [];
    const lines = strings(entry.lines);
    const multiplier = Number(entry.multiplier);
    if (lines.length === 0 || !Number.isFinite(multiplier)) return [];
    return [{ id: entry.id, recipeName: entry.recipeName, lines, multiplier }];
  });
}

/**
 * One week's list as stored in the browser before migration 031.
 */
export function readLegacyWeek(storage: Pick<Storage, "getItem">, weekKey: string, isCurrentWeek: boolean): ShoppingState {
  const checked = parse(storage.getItem(legacyKeys.checked(weekKey)));
  const week = parse(storage.getItem(legacyKeys.week(weekKey))) as { excludedRecipeIds?: unknown; extras?: unknown } | null;

  return {
    checked: strings(checked ?? (isCurrentWeek ? parse(storage.getItem(legacyKeys.unscopedChecked)) : null)),
    removed: strings(parse(storage.getItem(legacyKeys.removed(weekKey)))),
    excludedRecipeIds: strings(week?.excludedRecipeIds),
    extras: parseExtras(week?.extras),
    customItems: parseCustomItems(parse(storage.getItem(legacyKeys.custom))),
    hideBasics: parse(storage.getItem(legacyKeys.hideBasics)) !== false,
    sectionOrder: strings(parse(storage.getItem(legacyKeys.sectionOrder))),
  };
}

export type LegacyImport = {
  // Week-bound changes by week key ("2026-11-02").
  weeks: Record<string, ShoppingOp[]>;
  // Custom items and settings, which belong to no week.
  general: ShoppingOp[];
};

/**
 * Turns the list kept in this browser into changes for the database, once, when
 * it moves there. Weeks before `oldestWeekKey` are skipped: nobody shops for
 * them any more.
 */
export function collectLegacyImport(
  storage: Pick<Storage, "getItem" | "key" | "length">,
  currentWeekKey: string,
  oldestWeekKey: string,
): LegacyImport {
  const weekKeys = new Set<string>([currentWeekKey]);
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(LEGACY_PREFIX)) continue;
    const weekKey = key.slice(key.lastIndexOf(":") + 1);
    if (WEEK_KEY_PATTERN.test(weekKey)) weekKeys.add(weekKey);
  }

  const weeks: Record<string, ShoppingOp[]> = {};
  for (const weekKey of [...weekKeys].sort()) {
    if (weekKey < oldestWeekKey) continue;
    const state = readLegacyWeek(storage, weekKey, weekKey === currentWeekKey);
    const ops: ShoppingOp[] = [
      ...state.checked.filter((key) => key.length <= ITEM_KEY_MAX).map((key) => markOp("checked", key)),
      ...state.removed.filter((key) => key.length <= ITEM_KEY_MAX).map((key) => markOp("removed", key)),
      ...state.excludedRecipeIds.map((key) => markOp("excluded_recipe", key)),
      ...state.extras.map((extra): ShoppingOp => ({ type: "add-extra", extra })),
    ];
    if (ops.length > 0) weeks[weekKey] = ops;
  }

  const general: ShoppingOp[] = parseCustomItems(parse(storage.getItem(legacyKeys.custom))).map((item) => ({
    type: "add-custom",
    item,
  }));
  const hideBasics = parse(storage.getItem(legacyKeys.hideBasics));
  const sectionOrder = strings(parse(storage.getItem(legacyKeys.sectionOrder)));
  if (hideBasics === false || sectionOrder.length > 0) {
    general.push({
      type: "settings",
      ...(hideBasics === false && { hideBasics: false }),
      ...(sectionOrder.length > 0 && { sectionOrder }),
    });
  }

  return { weeks, general };
}

const markOp = (kind: ShoppingMarkKind, key: string): ShoppingOp => ({ type: "mark", kind, key, on: true });
