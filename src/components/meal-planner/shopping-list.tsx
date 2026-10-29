"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ListOrdered, Plus, Share, X } from "lucide-react";
import toast from "react-hot-toast";
import type { ShoppingListItem } from "@/types/database";
import { isBasicIngredient } from "@/lib/shopping-list";
import {
  formatShoppingAmount,
  getShoppingSection,
  orderShoppingSections,
  shoppingItemLabel,
  type ShoppingSectionId,
} from "@/lib/shopping-sections";
import type { ShoppingExtra } from "@/lib/shopping-list";
import { formatWeekRange } from "@/lib/week";
import { cn } from "@/lib/utils";
import { useEntrance } from "@/hooks/use-entrance";
import { useSelectedWeek } from "@/hooks/use-selected-week";

interface ShoppingListProps {
  items: ShoppingListItem[];
  pantryStaples: string[];
  // Off for the landing page demo, so it never touches a real list on this device.
  persist?: boolean;
  // Keep the header card on large screens too, e.g. in the demo's phone frame.
  // By default it drops the card there, since the desktop side panel is already one.
  alwaysCard?: boolean;
  // The week's planned recipes; tapping one leaves it off the list.
  recipes?: { id: string; name: string; excluded: boolean }[];
  onToggleRecipe?: (recipeId: string) => void;
  // Ingredients put on the list from a recipe without planning it.
  extras?: ShoppingExtra[];
  onRemoveExtra?: (id: string) => void;
}

type CustomItem = { id: string; label: string; amount?: string };

type Row = {
  key: string;
  label: string;
  amount: string;
  sources: string[];
  section: ShoppingSectionId;
  basic: boolean;
  customId?: string;
};

const CHECKED_ITEMS_STORAGE_KEY = "weekly-meal-planner:shopping-list:checked-items";
const HIDE_BASICS_STORAGE_KEY = "weekly-meal-planner:shopping-list:hide-basics";
const CUSTOM_ITEMS_STORAGE_KEY = "weekly-meal-planner:shopping-list:custom-items";
const SECTION_ORDER_STORAGE_KEY = "weekly-meal-planner:shopping-list:section-order";

function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : (JSON.parse(stored) as T);
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; the list still works for this session.
  }
}

const getItemKey = (item: ShoppingListItem) =>
  `${item.ingredient.trim().toLowerCase()}|${item.unit.trim().toLowerCase()}`;

/**
 * The list as plain text for messengers: only what is still missing, by section.
 */
function buildShareText(sections: { label: string; emoji: string; rows: Row[] }[], weekRange: string) {
  const blocks = sections.map(
    (section) =>
      `${section.emoji} ${section.label}\n${section.rows
        .map((row) => (row.amount ? `• ${row.label} – ${row.amount}` : `• ${row.label}`))
        .join("\n")}`,
  );
  return [`🛒 Einkauf ${weekRange}`, ...blocks].join("\n\n");
}

export function ShoppingList({
  items,
  pantryStaples,
  persist = true,
  alwaysCard = false,
  recipes = [],
  onToggleRecipe,
  extras = [],
  onRemoveExtra,
}: ShoppingListProps) {
  const { weekKey, monday, label: weekLabel, isCurrentWeek } = useSelectedWeek();
  const weekRange = formatWeekRange(monday);
  // Checks belong to one week's list, so switching weeks doesn't clear them. The
  // planner remounts the list for each week, so the key is fixed while mounted.
  const checkedStorageKey = `${CHECKED_ITEMS_STORAGE_KEY}:${weekKey}`;
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [hideBasics, setHideBasics] = useState(true);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const addFormRef = useRef<HTMLFormElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!persist) return;
    // Checks from before lists were kept per week belong to this week.
    const storedChecked = readStorage<unknown>(
      checkedStorageKey,
      isCurrentWeek ? readStorage<unknown>(CHECKED_ITEMS_STORAGE_KEY, []) : [],
    );
    setCheckedKeys(
      new Set(Array.isArray(storedChecked) ? storedChecked.filter((key) => typeof key === "string") : []),
    );
    const storedCustom = readStorage<unknown>(CUSTOM_ITEMS_STORAGE_KEY, []);
    setCustomItems(Array.isArray(storedCustom) ? (storedCustom as CustomItem[]) : []);
    setHideBasics(readStorage<unknown>(HIDE_BASICS_STORAGE_KEY, true) !== false);
    const storedOrder = readStorage<unknown>(SECTION_ORDER_STORAGE_KEY, []);
    setSectionOrder(Array.isArray(storedOrder) ? storedOrder.filter((id) => typeof id === "string") : []);
    setHydrated(true);
  }, [persist, checkedStorageKey, isCurrentWeek]);

  useEffect(() => {
    if (persist && hydrated) writeStorage(checkedStorageKey, Array.from(checkedKeys));
  }, [checkedKeys, hydrated, persist, checkedStorageKey]);

  useEffect(() => {
    if (persist && hydrated) writeStorage(CUSTOM_ITEMS_STORAGE_KEY, customItems);
  }, [customItems, hydrated, persist]);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const rows = useMemo<Row[]>(
    () => [
      ...items.map((item) => ({
        key: getItemKey(item),
        label: shoppingItemLabel(item),
        amount: formatShoppingAmount(item.quantity, item.unit),
        sources: item.sources ?? [],
        section: getShoppingSection(item),
        basic: isBasicIngredient(item.ingredient, pantryStaples),
      })),
      ...customItems.map((item) => ({
        key: `custom|${item.id}`,
        label: item.label,
        amount: item.amount ?? "",
        sources: [],
        section: getShoppingSection({ ingredient: item.label, unit: "" }),
        basic: false,
        customId: item.id,
      })),
    ],
    [items, customItems, pantryStaples],
  );

  // Forget checks for items that left the list (e.g. a meal was removed). An
  // empty list is most likely a week still loading, so its checks are kept.
  useEffect(() => {
    if ((persist && !hydrated) || items.length === 0) return;
    const validKeys = new Set(rows.map((row) => row.key));
    setCheckedKeys((prev) => {
      const next = new Set([...prev].filter((key) => validKeys.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows, items.length, hydrated, persist]);

  const hiddenBasics = hideBasics ? rows.filter((row) => row.basic) : [];
  const visibleRows = hideBasics ? rows.filter((row) => !row.basic) : rows;
  const openRows = visibleRows.filter((row) => !checkedKeys.has(row.key));
  const doneRows = visibleRows.filter((row) => checkedKeys.has(row.key));

  const orderedSections = orderShoppingSections(sectionOrder);
  const sections = orderedSections.map((section) => ({
    ...section,
    rows: openRows
      .filter((row) => row.section === section.id)
      .sort((a, b) => a.label.localeCompare(b.label, "de")),
  })).filter((section) => section.rows.length > 0);

  const recipeCount = new Set(items.flatMap((item) => item.sources ?? [])).size;
  const progress = visibleRows.length > 0 ? doneRows.length / visibleRows.length : 0;

  const toggle = (key: string) => {
    if (navigator.vibrate) navigator.vibrate(8);
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleHideBasics = () => {
    setHideBasics((prev) => {
      if (persist) writeStorage(HIDE_BASICS_STORAGE_KEY, !prev);
      return !prev;
    });
  };

  const addCustomItem = (event: React.FormEvent) => {
    event.preventDefault();
    const label = newItem.trim();
    if (!label) {
      setAdding(false);
      return;
    }
    const amount = newAmount.trim();
    setCustomItems((prev) => [...prev, { id: crypto.randomUUID(), label, ...(amount && { amount }) }]);
    setNewItem("");
    setNewAmount("");
    addInputRef.current?.focus();
  };

  // Closes the empty form once the focus leaves both of its fields.
  const closeAddFormIfEmpty = (event: React.FocusEvent) => {
    if (addFormRef.current?.contains(event.relatedTarget as Node | null)) return;
    if (!newItem.trim() && !newAmount.trim()) setAdding(false);
  };

  const moveSection = (index: number, delta: number) => {
    const ids = orderedSections.map((section) => section.id as string);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setSectionOrder(ids);
    if (persist) writeStorage(SECTION_ORDER_STORAGE_KEY, ids);
  };

  const resetSectionOrder = () => {
    setSectionOrder([]);
    if (persist) writeStorage(SECTION_ORDER_STORAGE_KEY, []);
  };

  const removeCustomItem = (id: string) =>
    setCustomItems((prev) => prev.filter((item) => item.id !== id));

  const share = async () => {
    if (sections.length === 0) {
      toast("Alles im Wagen 🎉");
      return;
    }

    const text = buildShareText(sections, weekRange);

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Liste kopiert");
    } catch {
      toast.error("Teilen nicht möglich");
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "space-y-3 rounded-[18px] bg-white p-4 ring-1 ring-brand-card-border",
          !alwaysCard && "lg:p-0 lg:ring-0",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-brand-ink">{weekLabel}</p>
            <p className="text-[13px] text-brand-secondary">
              {weekLabel !== weekRange && weekRange}
              {recipeCount > 0 &&
                `${weekLabel !== weekRange ? " · " : ""}${recipeCount} ${recipeCount === 1 ? "Rezept" : "Rezepte"}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="Artikel hinzufügen"
              className="flex size-10 items-center justify-center rounded-full bg-brand-chip-neutral text-brand-ink transition-transform active:scale-90"
            >
              <Plus className="size-[18px]" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => void share()}
              aria-label="Liste teilen"
              className="flex size-10 items-center justify-center rounded-full bg-brand-chip-neutral text-brand-ink transition-transform active:scale-90"
            >
              <Share className="size-[18px]" />
            </button>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[13px] font-semibold">
              <span className="min-w-0 truncate text-brand-ink">
                {doneRows.length} von {visibleRows.length} im Wagen
              </span>
              {(hiddenBasics.length > 0 || !hideBasics) && (
                // Same one-line label in both states, so switching doesn't reflow the row.
                <button
                  type="button"
                  onClick={toggleHideBasics}
                  aria-pressed={hideBasics}
                  aria-label={
                    hideBasics
                      ? `${hiddenBasics.length} Grundzutaten ausgeblendet, einblenden`
                      : "Grundzutaten ausblenden"
                  }
                  className={cn(
                    "flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 transition-colors active:scale-95",
                    hideBasics ? "bg-brand-chip-neutral text-brand-secondary" : "text-brand-secondary",
                  )}
                >
                  {hideBasics ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  Grundzutaten
                  {hideBasics && <span className="tabular-nums text-brand-muted">· {hiddenBasics.length}</span>}
                </button>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-brand-track">
              <div
                className="h-full rounded-full bg-brand-accent transition-[width] duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {(recipes.length > 0 || extras.length > 0) && (
          <div className="space-y-1.5">
            <p className="text-xs text-brand-secondary">
              {onToggleRecipe && recipes.length > 0
                ? "Tippe ein Rezept an, um es diesmal nicht einzukaufen."
                : "Rezepte auf der Liste"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onToggleRecipe?.(recipe.id)}
                  disabled={!onToggleRecipe}
                  aria-pressed={!recipe.excluded}
                  className={cn(
                    "flex h-8 max-w-full items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition-all active:scale-95",
                    recipe.excluded
                      ? "bg-transparent text-brand-muted line-through ring-1 ring-brand-card-border"
                      : "bg-brand-accent-bg text-brand-accent-dark",
                  )}
                >
                  <span className="truncate">{recipe.name}</span>
                </button>
              ))}
              {extras.map((extra) => (
                <span
                  key={extra.id}
                  className="flex h-8 max-w-full items-center gap-0.5 rounded-full bg-brand-chip-neutral pl-3 pr-1 text-[13px] font-semibold text-brand-ink"
                >
                  <span className="truncate">
                    {extra.recipeName}
                    <span className="font-normal text-brand-secondary"> · {extra.lines.length} {extra.lines.length === 1 ? "Zutat" : "Zutaten"}</span>
                  </span>
                  {onRemoveExtra && (
                    <button
                      type="button"
                      onClick={() => onRemoveExtra(extra.id)}
                      aria-label={`${extra.recipeName} von der Liste nehmen`}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-brand-tertiary active:bg-black/5"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {adding && (
        <form
          ref={addFormRef}
          onSubmit={addCustomItem}
          className="flex animate-fade-up items-center gap-2 rounded-[18px] bg-white p-2 pl-4 ring-1 ring-brand-card-border"
        >
          <input
            ref={addInputRef}
            value={newItem}
            onChange={(event) => setNewItem(event.target.value)}
            onBlur={closeAddFormIfEmpty}
            placeholder="z. B. Spülmittel"
            aria-label="Artikel"
            enterKeyHint="next"
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-brand-ink outline-none placeholder:text-brand-muted"
          />
          <input
            value={newAmount}
            onChange={(event) => setNewAmount(event.target.value)}
            onBlur={closeAddFormIfEmpty}
            placeholder="Menge"
            aria-label="Menge"
            enterKeyHint="done"
            maxLength={30}
            className="h-10 w-20 shrink-0 rounded-xl bg-brand-chip-neutral px-2.5 text-[15px] text-brand-ink outline-none placeholder:text-brand-muted"
          />
          <button
            type="submit"
            className="h-10 rounded-xl bg-brand-accent-dark px-4 text-sm font-bold text-white transition-transform active:scale-95"
          >
            Hinzufügen
          </button>
        </form>
      )}

      {ordering && (
        <section
          aria-label="Reihenfolge der Bereiche"
          className="animate-fade-up rounded-[18px] bg-white py-1 pl-3.5 pr-1 ring-1 ring-brand-card-border"
        >
          <div className="flex items-center justify-between gap-2 py-2 pr-2">
            <h3 className="text-[15px] font-bold text-brand-ink">Reihenfolge wie im Laden</h3>
            <button
              type="button"
              onClick={() => setOrdering(false)}
              className="h-8 rounded-full bg-brand-accent-dark px-3.5 text-[13px] font-bold text-white transition-transform active:scale-95"
            >
              Fertig
            </button>
          </div>
          <ol>
            {orderedSections.map((section, index) => (
              <li key={section.id} className="flex min-h-11 items-center gap-2 border-b border-brand-divider last:border-b-0">
                <span aria-hidden="true">{section.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-brand-ink">{section.label}</span>
                <button
                  type="button"
                  onClick={() => moveSection(index, -1)}
                  disabled={index === 0}
                  aria-label={`${section.label} nach oben`}
                  className="flex size-9 items-center justify-center rounded-full text-brand-secondary active:bg-brand-chip-neutral disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 1)}
                  disabled={index === orderedSections.length - 1}
                  aria-label={`${section.label} nach unten`}
                  className="flex size-9 items-center justify-center rounded-full text-brand-secondary active:bg-brand-chip-neutral disabled:opacity-30"
                >
                  <ArrowDown className="size-4" />
                </button>
              </li>
            ))}
          </ol>
          {sectionOrder.length > 0 && (
            <button
              type="button"
              onClick={resetSectionOrder}
              className="my-1.5 h-8 rounded-full px-2 text-[13px] font-semibold text-brand-secondary active:bg-brand-chip-neutral"
            >
              Zurücksetzen
            </button>
          )}
        </section>
      )}

      {rows.length === 0 && !adding ? (
        <div className="rounded-[18px] bg-white px-6 py-10 text-center ring-1 ring-brand-card-border">
          <p className="text-3xl" aria-hidden="true">🧺</p>
          <p className="mt-2 font-heading text-lg font-extrabold text-brand-ink">Noch nichts zu kaufen</p>
          <p className="mt-1 text-sm text-brand-secondary">
            Plane Mahlzeiten für {isCurrentWeek ? "diese Woche" : "die Woche"}, dann steht hier alles, was du brauchst.
          </p>
        </div>
      ) : (
        <>
          {sections.map((section) => (
            <section
              key={section.id}
              aria-label={section.label}
              className="rounded-[18px] bg-white py-1 pl-3.5 pr-1 ring-1 ring-brand-card-border"
            >
              <h3 className="flex items-center gap-1.5 pb-1 pt-2.5 text-xs font-bold uppercase tracking-[0.06em] text-brand-accent-dark">
                <span aria-hidden="true">{section.emoji}</span>
                {section.label}
                <span className="text-brand-muted">· {section.rows.length}</span>
              </h3>
              <ul>
                {section.rows.map((row) => (
                  <ShoppingRow
                    key={row.key}
                    row={row}
                    checked={false}
                    onToggle={() => toggle(row.key)}
                    onRemove={row.customId ? () => removeCustomItem(row.customId!) : undefined}
                  />
                ))}
              </ul>
            </section>
          ))}

          {sections.length === 0 && doneRows.length > 0 && (
            <p className="animate-pop-in py-2 text-center text-sm font-semibold text-brand-accent-dark">
              Alles im Wagen 🎉
            </p>
          )}

          {doneRows.length > 0 && (
            <section
              aria-label="Im Wagen"
              className="rounded-[18px] bg-white py-1 pl-3.5 pr-1 ring-1 ring-brand-card-border"
            >
              <h3 className="flex items-center gap-1.5 pb-1 pt-2.5 text-xs font-bold uppercase tracking-[0.06em] text-brand-muted">
                <Check className="size-3.5" strokeWidth={3} />
                Im Wagen · {doneRows.length}
              </h3>
              <ul>
                {doneRows.map((row) => (
                  <ShoppingRow
                    key={row.key}
                    row={row}
                    checked
                    onToggle={() => toggle(row.key)}
                    onRemove={row.customId ? () => removeCustomItem(row.customId!) : undefined}
                  />
                ))}
              </ul>
            </section>
          )}

          {!ordering && sections.length > 0 && (
            <button
              type="button"
              onClick={() => setOrdering(true)}
              className="mx-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-brand-secondary transition-transform active:scale-95 active:bg-brand-chip-neutral"
            >
              <ListOrdered className="size-4" />
              Reihenfolge anpassen
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ShoppingRow({
  row,
  checked,
  onToggle,
  onRemove,
}: {
  row: Row;
  checked: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  // Rows rise in when they move between the open list and "Im Wagen".
  const { entering, onAnimationEnd } = useEntrance();

  return (
    <li
      className={cn("flex items-center border-b border-brand-divider last:border-b-0", entering && "animate-rise")}
      onAnimationEnd={onAnimationEnd}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className={cn(
          "flex min-w-0 flex-1 touch-manipulation items-center gap-3 py-2 pr-3 text-left transition-colors active:bg-brand-accent-bg-light",
          checked ? "min-h-11" : "min-h-[52px]",
        )}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-150",
            checked ? "bg-brand-accent text-white" : "border-2 border-brand-disabled",
          )}
        >
          {checked && <Check className="size-3.5 animate-pop-in" strokeWidth={3} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "text-[15px]",
              checked ? "text-brand-muted line-through" : "font-semibold text-brand-ink",
            )}
          >
            {row.label}
          </span>
          {!checked && row.sources.length > 0 && (
            <span className="truncate text-xs text-brand-tertiary">{row.sources.join(" · ")}</span>
          )}
        </span>
        {row.amount && (
          <span
            className={cn(
              "shrink-0 whitespace-nowrap text-[15px]",
              checked ? "text-brand-muted" : "font-bold text-brand-ink",
            )}
          >
            {row.amount}
          </span>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${row.label} entfernen`}
          className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-brand-tertiary transition-colors active:bg-brand-chip-neutral"
        >
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}
