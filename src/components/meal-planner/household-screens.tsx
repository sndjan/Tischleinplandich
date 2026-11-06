"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Link2, Loader2, Pencil, RotateCcw, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { useActiveHousehold, useProfileQuery, useUserId } from "@/hooks/use-planner-data";
import { useHouseholdActions } from "@/hooks/use-households";
import {
  formatMemberNames,
  getDefaultServings,
  HOUSEHOLD_NAME_MAX_LENGTH,
  householdLabel,
  inviteUrl,
  MAX_HOUSEHOLD_MEMBERS,
  MAX_SHARED_HOUSEHOLDS,
  sharedHouseholds,
  type Household,
} from "@/lib/households";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Stepper } from "@/components/ui/controls";
import { SubPage } from "./sub-page";
import { useScreenStack } from "./screen-stack";
import { useSaveDisplayName } from "./profile-screen";

const MIGRATION_HINT =
  "Gemeinsame Haushalte brauchen noch ein kleines Datenbank-Update (supabase/migrations/030_households.sql).";

const cardClass = "overflow-hidden rounded-[18px] bg-white ring-1 ring-brand-card-border";
const inputClass =
  "h-11 w-full rounded-xl bg-brand-chip-neutral px-3 text-[15px] text-brand-ink outline-none placeholder:text-brand-muted focus:ring-2 focus:ring-brand-accent";
const primaryButtonClass =
  "flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-accent-dark px-4 text-sm font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-40";

/**
 * "Anna, Ben und du" for a household row.
 */
function describeMembers(household: Household, userId: string | null) {
  if (household.isPersonal) return "Nur du";
  const others = household.members.filter((member) => member.userId !== userId).map((member) => member.displayName);
  return others.length === 0 ? "Bisher nur du" : `${formatMemberNames(others)} und du`;
}

/**
 * Profile → "Haushalt": which household the planner shows, and creating a
 * shared one.
 */
export function HouseholdsScreen({ onBack }: { onBack: () => void }) {
  const userId = useUserId();
  const { openScreen } = useScreenStack();
  const { data, household: active } = useActiveHousehold();
  const actions = useHouseholdActions();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const choose = async (household: Household) => {
    if (household.id === active?.id || switchingTo) return;
    setSwitchingTo(household.id);
    // Null means the personal household, which is also the fallback.
    const result = await actions.setActive(household.isPersonal ? null : household.id);
    setSwitchingTo(null);
    if (result.ok) toast.success(`Du planst jetzt in „${householdLabel(household)}“`);
  };

  const shared = data ? sharedHouseholds(data) : [];

  return (
    <SubPage
      title="Haushalt"
      description="Im gemeinsamen Haushalt plant ihr dieselbe Woche und seht Änderungen der anderen sofort."
      tone="muted"
      onBack={onBack}
    >
      {data && !data.ready ? (
        <p className="rounded-2xl bg-[#fdf0d5] p-4 text-sm leading-relaxed text-[#7a4f0e]">{MIGRATION_HINT}</p>
      ) : (
        <>
          <section className={cardClass} aria-label="Haushalte">
            {(data?.households ?? []).map((household) => {
              const isActive = household.id === active?.id;
              return (
                <div key={household.id} className="flex items-center border-b border-brand-divider last:border-b-0">
                  <button
                    type="button"
                    onClick={() => void choose(household)}
                    aria-pressed={isActive}
                    className="flex min-h-16 min-w-0 flex-1 items-center gap-3.5 px-3.5 text-left transition-colors active:bg-brand-accent-bg-light"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-[10px] text-lg",
                        household.isPersonal ? "bg-brand-chip-neutral" : "bg-brand-accent-bg",
                      )}
                      aria-hidden="true"
                    >
                      {household.isPersonal ? "🙂" : "🏠"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-brand-ink">{householdLabel(household)}</span>
                      <span className="block truncate text-[13px] text-brand-secondary">
                        {describeMembers(household, userId)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        isActive ? "bg-brand-accent-dark text-white" : "ring-2 ring-brand-card-border",
                      )}
                    >
                      {switchingTo === household.id ? (
                        <Loader2 className="size-3.5 animate-spin text-brand-secondary" />
                      ) : (
                        isActive && <Check className="size-3.5" strokeWidth={3} />
                      )}
                    </span>
                  </button>
                  {!household.isPersonal && (
                    <button
                      type="button"
                      onClick={() => openScreen({ kind: "household", householdId: household.id })}
                      aria-label={`${householdLabel(household)} verwalten`}
                      className="flex h-16 w-12 shrink-0 items-center justify-center border-l border-brand-divider text-brand-muted transition-colors active:bg-brand-accent-bg-light"
                    >
                      <ChevronRight className="size-[18px]" />
                    </button>
                  )}
                </div>
              );
            })}
          </section>

          {data &&
            (shared.length < MAX_SHARED_HOUSEHOLDS ? (
              <CreateHouseholdCard
                onCreated={(id) => openScreen({ kind: "household", householdId: id })}
              />
            ) : (
              <p className="px-1 text-[13px] text-brand-secondary">
                Du bist schon in {MAX_SHARED_HOUSEHOLDS} gemeinsamen Haushalten, mehr geht nicht. Verlass einen, um einen
                neuen anzulegen oder beizutreten.
              </p>
            ))}

          <p className="px-1 text-[13px] leading-relaxed text-brand-secondary">
            Im gemeinsamen Haushalt sehen alle die Rezepte der anderen (ohne Bewertungen) und können sie einplanen.
            Ändern kann jede:r nur die eigenen. Tagesziele bleiben persönlich.
          </p>
        </>
      )}
    </SubPage>
  );
}

/**
 * Name field for people who haven't picked one yet: members see each other by name.
 */
function useNameRequirement() {
  const { data: profile } = useProfileQuery();
  const saveDisplayName = useSaveDisplayName();
  const [name, setName] = useState("");
  const needsName = profile !== undefined && !profile.displayName;

  // Resolves false when the name could not be saved (the error is shown).
  const ensureName = async () => {
    if (!needsName) return true;
    if (!name.trim()) {
      toast.error("Gib dir zuerst einen Namen");
      return false;
    }
    return saveDisplayName(name);
  };

  const field = needsName ? (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-bold text-brand-secondary">Dein Name (sehen die anderen)</span>
      <input
        value={name}
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        placeholder="z. B. Jan"
        autoComplete="given-name"
        className={inputClass}
      />
    </label>
  ) : null;

  return { field, ensureName };
}

function CreateHouseholdCard({ onCreated }: { onCreated: (householdId: string) => void }) {
  const actions = useHouseholdActions();
  const { field: nameField, ensureName } = useNameRequirement();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      if (!(await ensureName())) return;
      const result = await actions.create(name.trim());
      if (result.ok) {
        toast.success(`„${name.trim()}“ angelegt`);
        setName("");
        onCreated(result.value);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={create} className={cn(cardClass, "space-y-3 p-3.5")}>
      <div className="flex items-center gap-2">
        <Users className="size-[18px] text-brand-accent-dark" />
        <h2 className="text-[15px] font-bold text-brand-ink">Gemeinsamen Haushalt anlegen</h2>
      </div>
      {nameField}
      <label className="block space-y-1.5">
        <span className="text-[13px] font-bold text-brand-secondary">Name des Haushalts</span>
        <input
          value={name}
          maxLength={HOUSEHOLD_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="z. B. WG Küche oder Familie"
          enterKeyHint="done"
          className={inputClass}
        />
      </label>
      <p className="text-[13px] text-brand-secondary">
        Er startet mit einem leeren Plan. Danach lädst du die anderen per Link ein.
      </p>
      <button type="submit" disabled={!name.trim() || creating} className={cn(primaryButtonClass, "w-full")}>
        {creating && <Loader2 className="size-4 animate-spin" />}
        Anlegen
      </button>
    </form>
  );
}

type Confirm = { kind: "leave" } | { kind: "delete" } | { kind: "remove"; userId: string; name: string };

/**
 * One shared household: members, invite link, number of people, and leaving
 * or (owner only) renaming, removing members and deleting it.
 */
export function HouseholdScreen({ householdId, onBack }: { householdId: string; onBack: () => void }) {
  const userId = useUserId();
  const { data, household: active } = useActiveHousehold();
  const actions = useHouseholdActions();
  const household = data?.households.find((entry) => entry.id === householdId) ?? null;
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  if (!household || household.isPersonal) {
    return (
      <SubPage title="Haushalt" tone="muted" onBack={onBack}>
        <p className="px-1 text-sm text-brand-secondary">
          {data ? "Du bist nicht mehr in diesem Haushalt." : "Lädt …"}
        </p>
      </SubPage>
    );
  }

  const isOwner = household.role === "owner";
  const isActive = household.id === active?.id;
  const full = household.members.length >= MAX_HOUSEHOLD_MEMBERS;
  const servings = getDefaultServings(household);
  const nextOwner = household.members.find((member) => member.userId !== userId);

  const finishRename = async () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === household.name) return;
    const result = await actions.rename(household.id, trimmed);
    if (result.ok) toast.success("Name gespeichert");
  };

  const shareInvite = async (reset = false) => {
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      const invite = await actions.getInvite(household.id, reset);
      if (!invite) return;
      const url = inviteUrl(window.location.origin, invite.token);
      const text = `Plan mit mir in „${householdLabel(household)}“ auf Tischleinplandich:`;

      if (!reset && navigator.share) {
        try {
          await navigator.share({ title: "Einladung", text, url });
          return;
        } catch (error) {
          // Closing the share sheet is not an error.
          if ((error as Error)?.name === "AbortError") return;
        }
      }

      await navigator.clipboard.writeText(url);
      toast.success(reset ? "Neuer Link kopiert, der alte gilt nicht mehr" : "Link kopiert");
    } catch (error) {
      console.error(error);
      toast.error("Link konnte nicht kopiert werden");
    } finally {
      setInviteBusy(false);
    }
  };

  const runConfirmed = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      if (confirm.kind === "remove") {
        const result = await actions.removeMember(household.id, confirm.userId);
        if (result.ok) toast.success(`${confirm.name} ist nicht mehr dabei`);
        setConfirm(null);
        return;
      }
      const result = confirm.kind === "leave" ? await actions.leave(household.id) : await actions.remove(household.id);
      if (result.ok) {
        toast.success(confirm.kind === "leave" ? "Haushalt verlassen" : "Haushalt gelöscht");
        setConfirm(null);
        onBack();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SubPage title={householdLabel(household)} tone="muted" onBack={onBack}>
      <section className={cn(cardClass, "flex items-center gap-3 px-3.5 py-3")}>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-accent-bg text-2xl" aria-hidden="true">
          🏠
        </span>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={name}
              maxLength={HOUSEHOLD_NAME_MAX_LENGTH}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => void finishRename()}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setEditingName(false);
              }}
              aria-label="Name des Haushalts"
              enterKeyHint="done"
              className="h-9 w-full rounded-lg border-2 border-brand-accent bg-white px-2 text-[17px] font-bold text-brand-ink outline-none"
            />
          ) : isOwner ? (
            <button
              type="button"
              onClick={() => {
                setName(household.name ?? "");
                setEditingName(true);
              }}
              className="flex max-w-full items-center gap-1.5 text-left text-[17px] font-bold text-brand-ink transition-opacity active:opacity-60"
            >
              <span className="truncate">{householdLabel(household)}</span>
              <Pencil className="size-3.5 shrink-0 text-brand-muted" />
            </button>
          ) : (
            <p className="truncate text-[17px] font-bold text-brand-ink">{householdLabel(household)}</p>
          )}
          <p className="text-[13px] text-brand-secondary">
            {household.members.length} {household.members.length === 1 ? "Person" : "Personen"}
            {isActive ? " · wird gerade geplant" : ""}
          </p>
        </div>
      </section>

      {!isActive && (
        <button
          type="button"
          onClick={async () => {
            const result = await actions.setActive(household.id);
            if (result.ok) toast.success(`Du planst jetzt in „${householdLabel(household)}“`);
          }}
          className={cn(primaryButtonClass, "w-full")}
        >
          In diesem Haushalt planen
        </button>
      )}

      <section className={cardClass} aria-label="Mitglieder">
        {household.members.map((member) => {
          const isMe = member.userId === userId;
          const memberName = member.displayName || "Jemand";
          return (
            <div key={member.userId} className="flex min-h-14 items-center gap-3 border-b border-brand-divider px-3.5 last:border-b-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-accent-bg font-heading text-[15px] font-extrabold text-brand-accent-dark">
                {memberName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-brand-ink">
                  {memberName}
                  {isMe && <span className="font-semibold text-brand-secondary"> (du)</span>}
                </span>
                {member.role === "owner" && <span className="block text-[13px] text-brand-secondary">Hat den Haushalt angelegt</span>}
              </span>
              {isOwner && !isMe && (
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: "remove", userId: member.userId, name: memberName })}
                  aria-label={`${memberName} entfernen`}
                  className="flex size-9 items-center justify-center rounded-full text-brand-tertiary transition-colors hover:bg-black/5 active:bg-black/10"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          );
        })}
      </section>

      <section className={cn(cardClass, "space-y-3 p-3.5")} aria-label="Einladen">
        {full ? (
          <p className="text-sm text-brand-secondary">
            Der Haushalt ist voll: Mehr als {MAX_HOUSEHOLD_MEMBERS} Leute gehen nicht.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void shareInvite()}
              disabled={inviteBusy}
              className={cn(primaryButtonClass, "w-full")}
            >
              {inviteBusy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Einladungslink teilen
            </button>
            <p className="text-[13px] leading-relaxed text-brand-secondary">
              Wer den Link hat, kann 7 Tage lang beitreten. Schick ihn nur Leuten, mit denen du planen willst.
            </p>
            <button
              type="button"
              onClick={() => void shareInvite(true)}
              disabled={inviteBusy}
              className="flex items-center gap-1.5 text-[13px] font-bold text-brand-accent-dark disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" />
              Link zurücksetzen und neuen kopieren
            </button>
          </>
        )}
      </section>

      <section className={cn(cardClass, "flex items-center gap-3 px-3.5 py-3")}>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-brand-ink">Personen am Tisch</span>
          <span className="block text-[13px] text-brand-secondary">So viele Portionen haben neue Mahlzeiten</span>
        </span>
        <Stepper
          value={servings}
          min={1}
          max={20}
          label="Personen"
          onChange={(value) => void actions.setServings(household.id, value)}
        />
      </section>

      <section className={cardClass}>
        <button
          type="button"
          onClick={() => setConfirm({ kind: "leave" })}
          className="flex min-h-14 w-full items-center px-3.5 text-left text-[15px] font-bold text-brand-red transition-colors active:bg-red-50"
        >
          Haushalt verlassen
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={() => setConfirm({ kind: "delete" })}
            className="flex min-h-14 w-full items-center border-t border-brand-divider px-3.5 text-left text-[15px] font-bold text-brand-red transition-colors active:bg-red-50"
          >
            Haushalt löschen
          </button>
        )}
      </section>

      {confirm && (
        <BottomSheet
          title={
            confirm.kind === "leave"
              ? "Haushalt verlassen?"
              : confirm.kind === "delete"
                ? "Haushalt löschen?"
                : `${confirm.name} entfernen?`
          }
          description={
            confirm.kind === "leave"
              ? `Deine Rezepte bleiben in den Wochen von „${householdLabel(household)}“ nur noch mit Namen stehen.` +
                (isOwner && nextOwner ? ` ${nextOwner.displayName || "Die nächste Person"} übernimmt den Haushalt.` : "") +
                (household.members.length === 1 ? " Du bist die letzte Person, der Haushalt wird gelöscht." : "")
              : confirm.kind === "delete"
                ? "Alle Wochenpläne des Haushalts werden für alle gelöscht. Eure Rezepte bleiben."
                : `${confirm.name} sieht den Plan nicht mehr. Die Rezepte von ${confirm.name} bleiben in euren Wochen nur mit Namen stehen.`
          }
          onClose={() => setConfirm(null)}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => void runConfirmed()}
            className="min-h-12 w-full rounded-full bg-brand-red px-4 font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy
              ? "Einen Moment …"
              : confirm.kind === "leave"
                ? "Verlassen"
                : confirm.kind === "delete"
                  ? "Endgültig löschen"
                  : "Entfernen"}
          </button>
        </BottomSheet>
      )}
    </SubPage>
  );
}
