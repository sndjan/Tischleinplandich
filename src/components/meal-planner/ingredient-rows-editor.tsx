"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, GripVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INGREDIENT_UNITS,
  newRowId,
  parseIngredientLine,
  type IngredientRow,
} from "@/lib/editable-recipe";

interface IngredientRowsEditorProps {
  rows: IngredientRow[];
  onChange: (rows: IngredientRow[]) => void;
  // Ingredient names from the user's other recipes.
  suggestions: string[];
  servingSize: number;
  onDone: () => void;
}

const emptyRow = (): IngredientRow => ({ id: newRowId(), quantity: "", unit: "", name: "" });

/**
 * Ingredients as rows of amount · unit · name. Pasting several lines splits them
 * into separate rows; rows can be reordered with the handle.
 */
export function IngredientRowsEditor({
  rows,
  onChange,
  suggestions,
  servingSize,
  onDone,
}: IngredientRowsEditorProps) {
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [pasteNotice, setPasteNotice] = useState<{ count: number; before: IngredientRow[] } | null>(
    null,
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rowElements = useRef(new Map<string, HTMLDivElement>());
  const nameInputs = useRef(new Map<string, HTMLInputElement>());

  const updateRow = (id: string, patch: Partial<IngredientRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const removeRow = (id: string) => onChange(rows.filter((row) => row.id !== id));

  const addRow = () => {
    const row = emptyRow();
    onChange([...rows, row]);
    requestAnimationFrame(() => nameInputs.current.get(row.id)?.focus());
  };

  const handlePaste = (rowId: string, event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    const lines = pasted
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return;

    event.preventDefault();
    const index = rows.findIndex((row) => row.id === rowId);
    const target = rows[index];
    const parsed = lines.map(parseIngredientLine);
    // An empty row is replaced by the pasted rows instead of staying behind.
    const isEmpty = target && !target.quantity && !target.unit && !target.name;
    const next = [
      ...rows.slice(0, isEmpty ? index : index + 1),
      ...parsed,
      ...rows.slice(index + 1),
    ];

    setPasteNotice({ count: parsed.length, before: rows });
    onChange(next);
  };

  const focusedRow = rows.find((row) => row.id === focusedRowId);
  const matchingSuggestions = useMemo(() => {
    const query = focusedRow?.name.trim().toLowerCase() ?? "";
    if (query.length < 2) return [];

    return suggestions
      .filter((name) => name.toLowerCase().startsWith(query) && name.toLowerCase() !== query)
      .slice(0, 3);
  }, [focusedRow?.name, suggestions]);

  // Reordering by dragging the handle; works with touch and mouse.
  const handlePointerDown = (rowId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(rowId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingId) return;

    const fromIndex = rows.findIndex((row) => row.id === draggingId);
    let toIndex = fromIndex;

    rows.forEach((row, index) => {
      const element = rowElements.current.get(row.id);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (event.clientY > rect.top && event.clientY < rect.bottom) toIndex = index;
    });

    if (toIndex !== fromIndex) {
      const next = [...rows];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onChange(next);
    }
  };

  const unitOptions = (unit: string) =>
    unit && !(INGREDIENT_UNITS as readonly string[]).includes(unit)
      ? [unit, ...INGREDIENT_UNITS]
      : INGREDIENT_UNITS;

  return (
    <div className="flex min-h-dvh flex-col bg-brand-app-bg">
      <header className="sticky top-0 z-40 border-b border-brand-card-border bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-2 py-3">
          <Button type="button" variant="ghost" size="icon-lg" onClick={onDone} aria-label="Zurück">
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-heading min-w-0 flex-1 truncate text-lg font-bold text-brand-ink">
            Zutaten
            <span className="ml-1.5 text-sm font-semibold text-brand-secondary">
              für {servingSize} {servingSize === 1 ? "Portion" : "Portionen"}
            </span>
          </h1>
          <Button type="button" onClick={onDone} className="h-10 rounded-full px-4 font-bold">
            Fertig
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 p-4">
        {pasteNotice && (
          <div
            role="status"
            className="animate-fade-up flex items-center gap-2 rounded-xl bg-brand-accent-bg px-3 py-2 text-[13px] font-semibold text-brand-accent-dark"
          >
            <Check className="size-4 shrink-0" strokeWidth={2.5} />
            <span className="flex-1">
              {pasteNotice.count} Zeilen eingefügt, als {pasteNotice.count} Zutaten übernommen
            </span>
            <button
              type="button"
              onClick={() => {
                onChange(pasteNotice.before);
                setPasteNotice(null);
              }}
              className="h-8 px-2 font-bold underline"
            >
              Rückgängig
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-brand-card-border bg-white">
          <div className="grid grid-cols-[20px_56px_68px_minmax(0,1fr)_32px] gap-2 border-b border-brand-divider px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-brand-secondary">
            <span />
            <span>Menge</span>
            <span>Einheit</span>
            <span>Zutat</span>
            <span />
          </div>

          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-brand-secondary">
              Noch keine Zutaten. Tipp: Eine ganze Liste einfügen legt alle Zeilen auf einmal an.
            </p>
          )}

          {rows.map((row) => (
            <div
              key={row.id}
              ref={(element) => {
                if (element) rowElements.current.set(row.id, element);
                else rowElements.current.delete(row.id);
              }}
              className={cn(
                "border-b border-brand-divider px-2.5 py-1.5 last:border-b-0",
                focusedRowId === row.id && "bg-brand-accent-bg-light",
                draggingId === row.id && "relative z-10 bg-white shadow-lg",
              )}
            >
              <div className="grid grid-cols-[20px_56px_68px_minmax(0,1fr)_32px] items-center gap-2">
                <button
                  type="button"
                  aria-label="Zum Verschieben ziehen"
                  onPointerDown={(event) => handlePointerDown(row.id, event)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={() => setDraggingId(null)}
                  onPointerCancel={() => setDraggingId(null)}
                  className="flex h-10 cursor-grab touch-none items-center justify-center text-brand-muted"
                >
                  <GripVertical className="size-4" />
                </button>
                <input
                  aria-label="Menge"
                  inputMode="decimal"
                  value={row.quantity}
                  onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                  onFocus={() => setFocusedRowId(row.id)}
                  onPaste={(event) => handlePaste(row.id, event)}
                  className="h-10 w-full rounded-lg border border-brand-input-border bg-white px-2 text-right text-[15px] font-semibold outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-bg"
                />
                <select
                  aria-label="Einheit"
                  value={row.unit}
                  onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                  onFocus={() => setFocusedRowId(row.id)}
                  className="h-10 w-full rounded-lg border border-brand-input-border bg-brand-app-bg-alt px-1.5 text-sm outline-none focus:border-brand-accent"
                >
                  <option value="">–</option>
                  {unitOptions(row.unit).map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
                <input
                  ref={(element) => {
                    if (element) nameInputs.current.set(row.id, element);
                    else nameInputs.current.delete(row.id);
                  }}
                  aria-label="Zutat"
                  value={row.name}
                  placeholder="Zutat"
                  onChange={(event) => updateRow(row.id, { name: event.target.value })}
                  onFocus={() => setFocusedRowId(row.id)}
                  onPaste={(event) => handlePaste(row.id, event)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addRow();
                    }
                  }}
                  className="h-10 w-full min-w-0 rounded-lg border border-brand-input-border bg-white px-2.5 text-[15px] outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-bg"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  aria-label={`${row.name || "Zutat"} entfernen`}
                  className="flex h-10 w-8 items-center justify-center rounded-lg text-brand-secondary active:bg-black/5"
                >
                  <X className="size-4" />
                </button>
              </div>

              {focusedRowId === row.id && matchingSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1.5 pl-[168px] pt-1.5 max-[420px]:pl-7">
                  {matchingSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => updateRow(row.id, { name })}
                      className="h-8 rounded-full border border-brand-track bg-white px-2.5 text-[13px] font-semibold text-brand-accent-dark active:scale-95"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-brand-disabled bg-brand-app-bg-alt text-sm font-semibold text-brand-accent-dark transition-transform active:scale-[0.98]"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Zutat hinzufügen
        </button>
        <p className="px-1 text-[13px] leading-relaxed text-brand-secondary">
          Mehrere Zeilen einfügen legt automatisch einzelne Zutaten an. Vorschläge kommen aus
          Zutaten, die du schon verwendest, damit die Einkaufsliste sauber zusammenfasst.
        </p>
      </main>
    </div>
  );
}
