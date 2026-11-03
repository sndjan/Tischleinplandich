"use client";

import { useState } from "react";
import { Check, Clock, Loader2, MapPin, Trash2, UserPlus, X } from "lucide-react";
import {
  formatDateBadge,
  formatEventDay,
  formatEventTime,
  initials,
  signupStatus,
  type ClubEvent,
} from "@/lib/club/events";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: ClubEvent;
  past?: boolean;
  highlighted?: boolean;
  ownSignupId: string | null;
  defaultName: string;
  isOrganizer: boolean;
  onSignUp: (event: ClubEvent, name: string) => Promise<boolean>;
  onSignOut: (event: ClubEvent, signupId: string) => Promise<void>;
  onDelete: (event: ClubEvent) => Promise<void>;
}

export function EventCard({
  event,
  past = false,
  highlighted = false,
  ownSignupId,
  defaultName,
  isOrganizer,
  onSignUp,
  onSignOut,
  onDelete,
}: EventCardProps) {
  const [askingName, setAskingName] = useState(false);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState<"in" | "out" | "delete" | null>(null);
  const [expanded, setExpanded] = useState(false);

  const badge = formatDateBadge(event.starts_at);
  const status = signupStatus(event.signups.length, event.helpers_needed);
  const longDescription = event.description.length > 180;

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!name.trim()) return;
    setBusy("in");
    if (await onSignUp(event, name.trim())) setAskingName(false);
    setBusy(null);
  };

  const signOut = async () => {
    if (!ownSignupId) return;
    setBusy("out");
    await onSignOut(event, ownSignupId);
    setBusy(null);
  };

  const remove = async () => {
    if (!window.confirm(`„${event.title}“ wirklich löschen? Alle Eintragungen gehen verloren.`)) return;
    setBusy("delete");
    await onDelete(event);
    setBusy(null);
  };

  return (
    <article
      id={`einsatz-${event.id}`}
      className={cn(
        "animate-rise scroll-mt-24 rounded-3xl border bg-white p-4 shadow-[0_1px_2px_rgba(22,33,58,0.04)] transition-shadow sm:p-5",
        highlighted ? "border-[#2f5fd0] ring-4 ring-[#2f5fd0]/15" : "border-[#e3e7ef]",
        past && "opacity-70",
      )}
    >
      <div className="flex gap-4">
        <div
          className={cn(
            "flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl",
            past ? "bg-[#eef0f4] text-[#5b6680]" : "bg-[#e8effd] text-[#1f3f8f]",
          )}
        >
          <span className="font-heading text-2xl font-black leading-none">{badge.day}</span>
          <span className="mt-0.5 text-xs font-bold uppercase tracking-wide">{badge.month}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-lg font-extrabold leading-snug text-[#16213a]">{event.title}</h3>
            {isOrganizer && (
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null}
                aria-label="Einsatz löschen"
                className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-[#8a94a8] transition hover:bg-[#fdeaea] hover:text-[#c73b3b] active:scale-90"
              >
                {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </button>
            )}
          </div>
          <div className="mt-1 space-y-0.5 text-sm text-[#5b6680]">
            <p className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {formatEventDay(event.starts_at)} · {formatEventTime(event.starts_at, event.ends_at)}
              </span>
            </p>
            {event.location && (
              <p className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{event.location}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {event.description && (
        <div className="mt-3">
          <p
            className={cn(
              "whitespace-pre-line text-[15px] leading-relaxed text-[#35405a]",
              longDescription && !expanded && "line-clamp-3",
            )}
          >
            {event.description}
          </p>
          {longDescription && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-1 text-sm font-semibold text-[#2f5fd0]"
            >
              {expanded ? "Weniger" : "Mehr lesen"}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-[#f5f7fb] p-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className={cn("font-semibold", status.full ? "text-[#2e8a57]" : "text-[#16213a]")}>
            {status.label}
          </span>
        </div>
        {status.progress !== null && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e1e6f0]">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                status.full ? "bg-[#2e8a57]" : "bg-[#2f5fd0]",
              )}
              style={{ width: `${Math.max(status.progress * 100, status.progress > 0 ? 6 : 0)}%` }}
            />
          </div>
        )}
        {event.signups.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {event.signups.map((signup) => {
              const mine = signup.id === ownSignupId;
              return (
                <li
                  key={signup.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-sm",
                    mine ? "bg-[#2f5fd0] text-white" : "bg-white text-[#35405a]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                      mine ? "bg-white/20" : "bg-[#e8effd] text-[#1f3f8f]",
                    )}
                    aria-hidden="true"
                  >
                    {initials(signup.name)}
                  </span>
                  {signup.name}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!past && (
        <div className="mt-3">
          {ownSignupId ? (
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-[#2e8a57]">
                <Check className="size-4" aria-hidden="true" />
                Du bist eingetragen
              </p>
              <button
                type="button"
                onClick={signOut}
                disabled={busy !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[#5b6680] transition hover:bg-[#f5f7fb] active:scale-95"
              >
                {busy === "out" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                Austragen
              </button>
            </div>
          ) : askingName ? (
            <form onSubmit={submit} className="flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Dein Name"
                aria-label="Dein Name"
                autoComplete="name"
                className="h-11 min-w-0 flex-1 rounded-full border border-[#d9dfea] bg-white px-4 text-base outline-none transition focus:border-[#2f5fd0] focus:ring-4 focus:ring-[#2f5fd0]/15"
              />
              <button
                type="submit"
                disabled={busy !== null || !name.trim()}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#2f5fd0] px-4 font-semibold text-white transition active:scale-95 disabled:opacity-50"
              >
                {busy === "in" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Eintragen
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAskingName(true)}
              className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98]",
                status.full
                  ? "border border-[#d9dfea] bg-white text-[#35405a]"
                  : "bg-[#2f5fd0] text-white shadow-[0_8px_18px_-10px_rgba(47,95,208,0.9)]",
              )}
            >
              <UserPlus className="size-4" aria-hidden="true" />
              {status.full ? "Trotzdem mithelfen" : "Ich bin dabei"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
