"use client";

import { useEffect, useState } from "react";
import { ShoppingListItem } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isBasicIngredient } from "@/lib/shopping-list";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";

interface ShoppingListProps {
  items: ShoppingListItem[];
}

const CHECKED_ITEMS_STORAGE_KEY =
  "weekly-meal-planner:shopping-list:checked-items";
const HIDE_BASICS_STORAGE_KEY = "weekly-meal-planner:shopping-list:hide-basics";

function getItemStorageKey(item: ShoppingListItem): string {
  return `${item.ingredient.trim().toLowerCase()}|${item.unit.trim().toLowerCase()}`;
}

export function ShoppingList({ items }: ShoppingListProps) {
  const [editableItems, setEditableItems] = useState<ShoppingListItem[]>(items);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);
  const [hideBasics, setHideBasics] = useState(false);

  useEffect(() => {
    try {
      setHideBasics(
        window.localStorage.getItem(HIDE_BASICS_STORAGE_KEY) === "true",
      );
    } catch {
      // Storage unavailable; keep the default.
    }
  }, []);

  const toggleHideBasics = () => {
    setHideBasics((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(HIDE_BASICS_STORAGE_KEY, String(next));
      } catch {
        // Storage unavailable; the toggle still works for this session.
      }
      return next;
    });
  };

  useEffect(() => {
    try {
      const storedItems = window.localStorage.getItem(
        CHECKED_ITEMS_STORAGE_KEY,
      );

      if (!storedItems) {
        return;
      }

      const parsed = JSON.parse(storedItems);

      if (!Array.isArray(parsed)) {
        return;
      }

      const validKeys = parsed.filter(
        (entry): entry is string => typeof entry === "string",
      );
      setCheckedItems(new Set(validKeys));
    } catch {
      // Ignore malformed data and start with an empty set.
    } finally {
      setIsStorageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isStorageHydrated) {
      return;
    }

    window.localStorage.setItem(
      CHECKED_ITEMS_STORAGE_KEY,
      JSON.stringify(Array.from(checkedItems)),
    );
  }, [checkedItems, isStorageHydrated]);

  useEffect(() => {
    setEditableItems(items);

    const validItemKeys = new Set(items.map((item) => getItemStorageKey(item)));

    setCheckedItems((prev) => {
      const nextCheckedItems = new Set<string>();

      prev.forEach((key) => {
        if (validItemKeys.has(key)) {
          nextCheckedItems.add(key);
        }
      });

      return nextCheckedItems;
    });
  }, [items]);

  const toggleItem = (rowKey: string) => {
    const newSet = new Set(checkedItems);
    if (newSet.has(rowKey)) {
      newSet.delete(rowKey);
    } else {
      newSet.add(rowKey);
    }
    setCheckedItems(newSet);
  };

  const updateItem = (index: number, updates: Partial<ShoppingListItem>) => {
    setEditableItems((prev) =>
      prev.map((item, currentIndex) =>
        currentIndex === index
          ? {
              ...item,
              ...updates,
            }
          : item,
      ),
    );
  };

  const removeItem = (index: number) => {
    const removedItem = editableItems[index];

    setEditableItems((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );

    if (!removedItem) {
      return;
    }

    const removedItemKey = getItemStorageKey(removedItem);
    setCheckedItems((prev) => {
      const nextCheckedItems = new Set(prev);
      nextCheckedItems.delete(removedItemKey);
      return nextCheckedItems;
    });
  };

  const addCustomItem = () => {
    setEditableItems((prev) => [
      ...prev,
      {
        ingredient: "",
        quantity: 1,
        unit: "",
      },
    ]);
  };

  const viewRows = editableItems.map((item, index) => {
    const key = `row-${index}`;
    const checkKey = getItemStorageKey(item);
    const isChecked = checkedItems.has(checkKey);
    const qty = Number.isInteger(item.quantity)
      ? String(item.quantity)
      : item.quantity.toFixed(2);
    const formattedIngredient = item.ingredient
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return {
      item,
      index,
      key,
      checkKey,
      isChecked,
      qty,
      formattedIngredient,
      itemLabel: item.unit
        ? `${qty} ${item.unit} ${formattedIngredient}`
        : `${qty} ${formattedIngredient}`,
    };
  });

  // Basic ingredients are only hidden in view mode; edit mode shows everything.
  const visibleViewRows = hideBasics
    ? viewRows.filter((row) => !isBasicIngredient(row.item.ingredient))
    : viewRows;
  const hiddenBasicRows = hideBasics
    ? viewRows.filter((row) => isBasicIngredient(row.item.ingredient))
    : [];
  const uncheckedViewRows = visibleViewRows.filter((row) => !row.isChecked);
  const checkedViewRows = visibleViewRows.filter((row) => row.isChecked);

  return (
    <div>
      <div className="flex items-center gap-2">
        {/* On desktop the panel tabs above already say "Einkaufsliste". */}
        <h2 className="font-heading text-lg font-bold text-brand-ink lg:hidden">
          Einkaufsliste
        </h2>
        <div className="flex-1" />
        <Button
          variant={hideBasics ? "default" : "outline"}
          size="icon"
          onClick={toggleHideBasics}
          aria-label="Grundzutaten ausblenden"
          aria-pressed={hideBasics}
          title={
            hideBasics ? "Grundzutaten einblenden" : "Grundzutaten ausblenden"
          }
        >
          {hideBasics ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={addCustomItem}
          disabled={!isEditMode}
          aria-label="Artikel hinzufügen"
          title="Artikel hinzufügen"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant={isEditMode ? "default" : "outline"}
          size="icon"
          onClick={() => setIsEditMode((prev) => !prev)}
          aria-label="Bearbeitungsmodus umschalten"
          title="Bearbeitungsmodus umschalten"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3">
        {editableItems.length === 0 ? (
          <p className="text-sm text-brand-tertiary">Liste ist leer</p>
        ) : !isEditMode ? (
          <div className="space-y-2">
            <ul className="space-y-1">
              {uncheckedViewRows.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center gap-2 text-sm leading-5"
                >
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleItem(row.checkKey)}
                    className="w-4 h-4"
                  />
                  <span>{row.itemLabel.trim()}</span>
                </li>
              ))}
            </ul>

            {hiddenBasicRows.length > 0 && (
              <details className="border-brand-card-border py-2">
                <summary className="cursor-pointer select-none text-xs text-brand-tertiary">
                  Grundzutaten ({hiddenBasicRows.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {hiddenBasicRows.map((row) => (
                    <li
                      key={row.key}
                      className={`flex items-center gap-2 text-sm leading-5 ${row.isChecked ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={row.isChecked}
                        onChange={() => toggleItem(row.checkKey)}
                        className="w-4 h-4"
                      />
                      <span
                        className={
                          row.isChecked
                            ? "text-brand-disabled line-through"
                            : ""
                        }
                      >
                        {row.itemLabel.trim()}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {checkedViewRows.length > 0 && (
              <details className=" border-brand-card-border py-2">
                <summary className="cursor-pointer select-none text-xs text-brand-tertiary">
                  Erledigt ({checkedViewRows.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {checkedViewRows.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center gap-2 text-sm leading-5 opacity-50"
                    >
                      <input
                        type="checkbox"
                        checked
                        onChange={() => toggleItem(row.checkKey)}
                        className="w-4 h-4"
                      />
                      <span className="text-brand-disabled line-through">
                        {row.itemLabel.trim()}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {viewRows.map((row) => {
              return (
                <li
                  key={row.key}
                  className={`grid grid-cols-[auto_84px_84px_1fr_auto] gap-2 items-center ${row.isChecked ? "opacity-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={row.isChecked}
                    onChange={() => toggleItem(row.checkKey)}
                    className="w-4 h-4"
                  />

                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.qty}
                    onChange={(event) => {
                      const parsed = Number.parseFloat(event.target.value);
                      updateItem(row.index, {
                        quantity:
                          Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                      });
                    }}
                    className="h-8"
                  />

                  <Input
                    value={row.item.unit}
                    onChange={(event) =>
                      updateItem(row.index, { unit: event.target.value })
                    }
                    placeholder="Einheit"
                    className="h-8"
                  />

                  <Input
                    value={row.formattedIngredient}
                    onChange={(event) =>
                      updateItem(row.index, { ingredient: event.target.value })
                    }
                    placeholder="Zutat"
                    className={`h-8 ${row.isChecked ? "line-through" : ""}`}
                  />

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeItem(row.index)}
                    className="h-8 px-2"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
