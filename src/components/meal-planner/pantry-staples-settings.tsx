"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { normalizePantryStapleName } from "@/lib/shopping-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubPage } from "./sub-page";

const FORM_ID = "pantry-staple-form";

const sortStaples = (staples: string[]) =>
  [...staples].sort((a, b) => a.localeCompare(b, "de"));

/**
 * Loads the user's pantry staples, the basic ingredients the shopping list can hide.
 */
export function usePantryStaples() {
  const [staples, setStaples] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const loadStaples = async () => {
      try {
        const user = await getSessionUser();

        if (!user) return;

        const { data, error } = await supabase
          .from("pantry_staples")
          .select("name")
          .eq("user_id", user.id);

        if (error) throw error;

        setStaples(sortStaples((data ?? []).map((row) => row.name)));
      } catch (err) {
        console.error(err);
        toast.error("Grundzutaten konnten nicht geladen werden");
      }
    };

    loadStaples();
  }, []);

  return [staples, setStaples] as const;
}

interface PantryStaplesScreenProps {
  staples: string[];
  onBack: () => void;
  onChange: (staples: string[]) => void;
}

export function PantryStaplesScreen({
  staples,
  onBack,
  onChange,
}: PantryStaplesScreenProps) {
  const [input, setInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  const normalizedInput = normalizePantryStapleName(input);
  // The input doubles as a filter so the long default list stays searchable.
  const visibleStaples = useMemo(
    () =>
      normalizedInput
        ? staples.filter((staple) => staple.includes(normalizedInput))
        : staples,
    [staples, normalizedInput],
  );

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!normalizedInput) return;

    if (staples.includes(normalizedInput)) {
      toast.error("Schon vorhanden");
      return;
    }

    setIsSaving(true);

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error("Nicht angemeldet");
        return;
      }

      const { error } = await supabase
        .from("pantry_staples")
        .insert({ user_id: user.id, name: normalizedInput });

      if (error) throw error;

      onChange(sortStaples([...staples, normalizedInput]));
      setInput("");
    } catch (err) {
      console.error(err);
      toast.error("Hinzufügen fehlgeschlagen");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (staple: string) => {
    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error("Nicht angemeldet");
        return;
      }

      const { error } = await supabase
        .from("pantry_staples")
        .delete()
        .eq("user_id", user.id)
        .eq("name", staple);

      if (error) throw error;

      onChange(staples.filter((current) => current !== staple));
    } catch (err) {
      console.error(err);
      toast.error("Entfernen fehlgeschlagen");
    }
  };

  return (
    <SubPage
      title="Grundzutaten"
      description="Zutaten, die du immer zu Hause hast. Die Einkaufsliste kann sie ausblenden."
      onBack={onBack}
    >
      <form id={FORM_ID} onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="z. B. Senf"
          aria-label="Grundzutat hinzufügen oder suchen"
          disabled={isSaving}
        />
        <Button
          type="submit"
          disabled={isSaving || !normalizedInput}
          aria-label="Hinzufügen"
        >
          <Plus className="h-4 w-4" />
          Hinzufügen
        </Button>
      </form>

      {visibleStaples.length === 0 ? (
        <p className="text-sm text-brand-tertiary">
          {staples.length === 0 ? "Noch keine Grundzutaten" : "Kein Treffer"}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {visibleStaples.map((staple) => (
            <li
              key={staple}
              className="inline-flex items-center gap-1 rounded-full bg-brand-chip-neutral py-1 pl-3 pr-1 text-sm text-brand-ink"
            >
              <span className="capitalize">{staple}</span>
              <button
                type="button"
                onClick={() => handleRemove(staple)}
                className="rounded-full p-1 hover:bg-black/5"
                aria-label={`${staple} entfernen`}
              >
                <X className="h-3.5 w-3.5 text-brand-tertiary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SubPage>
  );
}
