"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const CACHE_STORAGE_KEY = "weekly-meal-planner:query-cache";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Bump when the shape of cached query data changes, so old caches are dropped.
const CACHE_BUSTER = "v1";

// localStorage can throw (private mode, blocked storage); the app then simply
// runs without the on-device cache.
const safeStorage = {
  getItem: (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage full or unavailable; the in-memory cache still works.
    }
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
};

/**
 * Shared data cache for the planner. Data is kept on the device so the app opens
 * with the last known state and refreshes in the background.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: CACHE_MAX_AGE_MS,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : safeStorage,
      key: CACHE_STORAGE_KEY,
      throttleTime: 500,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE_MS, buster: CACHE_BUSTER }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
