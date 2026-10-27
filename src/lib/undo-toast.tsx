"use client";

import toast from "react-hot-toast";

const UNDO_WINDOW_MS = 5000;

// Commits waiting for their undo window to end. They are flushed when the page is
// hidden, so a deletion isn't lost when the app is closed right after.
const pendingCommits = new Set<() => void>();
let flushListenerAdded = false;

function ensureFlushListener() {
  if (flushListenerAdded || typeof window === "undefined") return;
  flushListenerAdded = true;

  const flush = () => [...pendingCommits].forEach((commit) => commit());

  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

interface UndoToastOptions {
  message: string;
  // Called if the user taps "Rückgängig" within the undo window.
  onUndo: () => void;
  // Called once the undo window has passed: performs the actual change.
  onCommit: () => void;
}

/**
 * Shows a toast with an undo button. The change itself should already be visible
 * (applied optimistically); it is only sent to the server once the toast expires.
 */
export function showUndoToast({ message, onUndo, onCommit }: UndoToastOptions) {
  ensureFlushListener();

  let settled = false;

  const commit = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    pendingCommits.delete(commit);
    onCommit();
  };

  const undo = (toastId: string) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    pendingCommits.delete(commit);
    toast.dismiss(toastId);
    onUndo();
  };

  const timer = setTimeout(commit, UNDO_WINDOW_MS);
  pendingCommits.add(commit);

  toast.custom(
    (t) => (
      <div
        role="status"
        className={`pointer-events-auto w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-brand-ink text-white shadow-lg transition-all ${
          t.visible ? "animate-toast-in" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-2 py-2 pl-4 pr-2">
          <span className="min-w-0 flex-1 truncate text-sm">{message}</span>
          <button
            type="button"
            onClick={() => undo(t.id)}
            className="h-9 shrink-0 rounded-lg px-3 text-sm font-bold text-[#9fe0b7] transition-transform active:scale-95 active:bg-white/10"
          >
            Rückgängig
          </button>
        </div>
        <div className="h-[3px] bg-white/15">
          <div
            className="h-full origin-left bg-[#9fe0b7]"
            style={{ animation: `toast-countdown ${UNDO_WINDOW_MS}ms linear forwards` }}
          />
        </div>
      </div>
    ),
    { duration: UNDO_WINDOW_MS },
  );
}
