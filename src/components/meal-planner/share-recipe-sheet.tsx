"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Loader2, Share } from "lucide-react";
import toast from "react-hot-toast";
import type { Recipe } from "@/types/database";
import { createShareId, shareUrl, useUpdateRecipeSharing, type SharingResult } from "@/lib/recipe-sharing";
import { useProfileQuery } from "@/hooks/use-planner-data";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Switch } from "@/components/ui/controls";
import { useSaveDisplayName } from "./profile-screen";

const MIGRATION_HINT =
  "Teilen braucht noch ein kleines Datenbank-Update (supabase/migrations/011_recipe_sharing.sql).";

/**
 * Share link (works without an account, shows only this recipe) and the switch
 * that lists the recipe for all users under "Entdecken".
 */
export function ShareRecipeSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const updateSharing = useUpdateRecipeSharing();
  const { data: profile } = useProfileQuery();
  const saveDisplayName = useSaveDisplayName();
  const [state, setState] = useState<"creating" | "ready" | "needs-migration">(
    recipe.share_id ? "ready" : "creating",
  );
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const startedRef = useRef(false);

  const report = (result: SharingResult) => {
    if (result === "needs-migration") setState("needs-migration");
    if (result === "error") toast.error("Das hat nicht geklappt");
    return result === "ok";
  };

  // A link is made the first time the sheet opens for a recipe.
  useEffect(() => {
    if (recipe.share_id || startedRef.current) return;
    startedRef.current = true;
    void updateSharing(recipe, { share_id: createShareId() }).then((result) => {
      if (report(result)) setState("ready");
    });
    // Runs once per opened sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const url = recipe.share_id ? shareUrl(recipe.share_id) : null;
  const askForName = profile?.sharingReady && !profile.displayName && !nameSaved;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopieren nicht möglich");
    }
  };

  const send = async () => {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.name, text: `Rezept: ${recipe.name}`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
    toast.success("Link kopiert");
  };

  const disableLink = async () => {
    if (report(await updateSharing(recipe, { share_id: null }))) {
      toast.success("Link deaktiviert");
      onClose();
    }
  };

  return (
    <BottomSheet
      title="Rezept teilen"
      description="Wer den Link hat, sieht nur dieses Rezept – auch ohne Konto."
      onClose={onClose}
    >
      {state === "needs-migration" ? (
        <p className="rounded-2xl bg-[#fdf0d5] p-4 text-sm leading-relaxed text-[#7a4f0e]">{MIGRATION_HINT}</p>
      ) : (
        <div className="space-y-4">
          {askForName && (
            <label className="block space-y-1.5 rounded-2xl bg-brand-accent-bg-light p-3.5 ring-1 ring-brand-accent/15">
              <span className="block text-[13px] font-bold text-brand-ink">Dein Name, damit man sieht, von wem es ist</span>
              <span className="flex gap-2">
                <input
                  value={name}
                  maxLength={40}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="z. B. Jan"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-brand-input-border bg-white px-3 text-[15px] outline-none focus:border-2 focus:border-brand-accent"
                />
                <button
                  type="button"
                  disabled={!name.trim()}
                  onClick={async () => {
                    if (await saveDisplayName(name)) setNameSaved(true);
                  }}
                  className="h-11 rounded-xl bg-brand-accent-dark px-4 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-40"
                >
                  Speichern
                </button>
              </span>
            </label>
          )}

          <div className="flex items-center gap-2.5 rounded-[14px] bg-brand-chip-neutral py-2 pl-3.5 pr-2">
            {state === "creating" ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-brand-secondary" />
            ) : (
              <Link2 className="size-4 shrink-0 text-brand-secondary" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-ink">
              {url ? url.replace(/^https?:\/\//, "") : "Link wird erstellt …"}
            </span>
            <button
              type="button"
              disabled={!url}
              onClick={() => void copy()}
              className="flex h-9 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[13px] font-bold text-brand-accent-dark transition-transform active:scale-95 disabled:opacity-40"
            >
              {copied ? <Check className="size-3.5 animate-pop-in" strokeWidth={3} /> : <Copy className="size-3.5" />}
              {copied ? "Kopiert" : "Kopieren"}
            </button>
          </div>

          <button
            type="button"
            disabled={!url}
            onClick={() => void send()}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand-accent-dark text-base font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            <Share className="size-[18px]" />
            Link senden …
          </button>

          <div className="h-px bg-brand-card-border" />

          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent-bg text-xl" aria-hidden="true">
              🌍
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-brand-ink">In „Entdecken“ zeigen</span>
              <span className="block text-[13px] leading-snug text-brand-secondary">
                Alle Tischleinplandich-Nutzer finden es und können es speichern.
              </span>
            </span>
            <Switch
              checked={recipe.is_public}
              label="In Entdecken zeigen"
              onChange={async (checked) => {
                if (report(await updateSharing(recipe, { is_public: checked }))) {
                  toast.success(checked ? "In Entdecken sichtbar" : "Nicht mehr in Entdecken");
                }
              }}
            />
          </div>

          {url && (
            <button
              type="button"
              onClick={() => void disableLink()}
              className="h-9 text-sm font-semibold text-brand-red transition-opacity active:opacity-60"
            >
              Link deaktivieren
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
