"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { normalizePantryStapleName } from "@/lib/shopping-list";
import { SubPage } from "./sub-page";
import { queryKeys, useActiveHousehold, useUserId } from "@/hooks/use-planner-data";
import type { PantryData } from "@/hooks/use-shopping-store";
import { householdLabel, isMissingHouseholdsError } from "@/lib/households";

const FORM_ID = "pantry-staple-form";

const EMPTY_STAPLES: string[] = [];

const sortStaples = (staples: string[]) =>
  [...staples].sort((a, b) => a.localeCompare(b, "de"));

/**
 * Where staples are kept: the active household's (migration 031), or the
 * user's own before that. Null while the household is still loading.
 */
function usePantryScope() {
  const userId = useUserId();
  const { household, data: households } = useActiveHousehold();
  const householdId = households?.ready ? household?.id ?? null : null;
  return {
    userId,
    householdId,
    resolved: households !== undefined,
    queryKey: queryKeys.pantryStaples(userId ?? "", householdId ?? "own"),
  };
}

async function fetchPantry(userId: string, householdId: string | null): Promise<PantryData> {
  const query = createClient().from("pantry_staples").select("id, name");
  let { data: rows, error } = await (householdId ? query.eq("household_id", householdId) : query.eq("user_id", userId));
  let byHousehold = Boolean(householdId);

  // Migration 031 missing: staples still belong to the user.
  if (householdId && (error?.code === "42703" || isMissingHouseholdsError(error))) {
    byHousehold = false;
    ({ data: rows, error } = await createClient().from("pantry_staples").select("id, name").eq("user_id", userId));
  }

  if (error) {
    toast.error("Grundzutaten konnten nicht geladen werden");
    throw error;
  }

  const sorted = [...(rows ?? [])].sort((a, b) => a.name.localeCompare(b.name, "de"));
  return { names: sorted.map((row) => row.name), ids: sorted.map((row) => row.id), byHousehold };
}

/**
 * Loads the pantry staples of the active household, the basic ingredients the
 * shopping list can hide. Everyone in a shared household shares them.
 */
export function usePantryStaples() {
  const queryClient = useQueryClient();
  const { userId, householdId, resolved, queryKey } = usePantryScope();

  const { data } = useQuery({
    queryKey,
    enabled: Boolean(userId) && resolved,
    queryFn: () => fetchPantry(userId!, householdId),
  });

  const setStaples = useCallback(
    (staples: string[]) =>
      queryClient.setQueryData<PantryData>(queryKey, (current) => ({
        names: staples,
        ids: current?.ids ?? [],
        byHousehold: current?.byHousehold ?? false,
      })),
    [queryClient, queryKey],
  );

  return [data?.names ?? EMPTY_STAPLES, setStaples] as const;
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
  const queryClient = useQueryClient();
  const scope = usePantryScope();
  const { queryKey } = scope;
  // Written where they were read from, so this works while migration 031 is missing.
  const householdId = queryClient.getQueryData<PantryData>(queryKey)?.byHousehold ? scope.householdId : null;
  const { household, isShared } = useActiveHousehold();

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
        .insert({ user_id: user.id, name: normalizedInput, ...(householdId && { household_id: householdId }) });

      // Someone else in the household added it a moment ago.
      if (error?.code === "23505") {
        void queryClient.invalidateQueries({ queryKey });
        setInput("");
        return;
      }
      if (error) throw error;

      onChange(sortStaples([...staples, normalizedInput]));
      void queryClient.invalidateQueries({ queryKey });
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

      const { error } = await (householdId
        ? supabase.from("pantry_staples").delete().eq("household_id", householdId).eq("name", staple)
        : supabase.from("pantry_staples").delete().eq("user_id", user.id).eq("name", staple));

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
      description={
        isShared && household
          ? `Zutaten, die ihr immer zu Hause habt. Gilt für alle in „${householdLabel(household)}“; die Einkaufsliste blendet sie aus.`
          : "Zutaten, die du immer zu Hause hast. Die Einkaufsliste blendet sie aus."
      }
      tone="muted"
      onBack={onBack}
    >
      <form
        id={FORM_ID}
        onSubmit={handleAdd}
        className="flex items-center gap-2 rounded-[18px] bg-white p-2 pl-4 ring-1 ring-brand-card-border"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="z. B. Senf"
          aria-label="Grundzutat hinzufügen oder suchen"
          disabled={isSaving}
          enterKeyHint="done"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-brand-ink outline-none placeholder:text-brand-muted"
        />
        <button
          type="submit"
          disabled={isSaving || !normalizedInput}
          className="flex h-10 items-center gap-1 rounded-xl bg-brand-accent-dark px-3.5 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-40"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Hinzufügen
        </button>
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
              className="inline-flex h-9 animate-fade-up items-center gap-0.5 rounded-full bg-white pl-3.5 pr-1 text-sm font-semibold text-brand-ink ring-1 ring-brand-card-border"
            >
              <span className="capitalize">{staple}</span>
              <button
                type="button"
                onClick={() => handleRemove(staple)}
                className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-black/5 active:bg-black/10"
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
