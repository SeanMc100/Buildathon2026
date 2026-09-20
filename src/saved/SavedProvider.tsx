// The shortlist: opportunities the visitor put aside to come back to.
// Sean owns this file (app shell).
//
// Kept on the device, like the intake answers and the joined boards. Screens
// only talk to useSaved(), so pointing this at an account later stays here.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'buildathon.saved.v1';
const STATE_VERSION = 1;

type SavedState = {
  version: number;
  /** Opportunity ids, most recently saved first. */
  ids: string[];
};

function emptyState(): SavedState {
  return { version: STATE_VERSION, ids: [] };
}

type SavedContextValue = {
  /** False until storage has been read. */
  hydrated: boolean;
  /** Most recently saved first. */
  ids: string[];
  count: number;
  isSaved: (id: string) => boolean;
  /** Saves if it is not saved, removes it if it is. Returns the new state. */
  toggle: (id: string) => boolean;
  remove: (id: string) => void;
  clear: () => void;
};

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SavedState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const saved = JSON.parse(raw) as SavedState;
          if (saved.version === STATE_VERSION && Array.isArray(saved.ids)) setState(saved);
        }
      } catch {
        // An unreadable store is not worth blocking the app; start fresh.
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          setHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist only after hydration so an empty list never overwrites a saved one.
  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // A lost write is survivable; the next change will try again.
    });
  }, [state]);

  const isSaved = useCallback((id: string) => state.ids.includes(id), [state.ids]);

  const toggle = useCallback((id: string) => {
    let nowSaved = false;
    setState((current) => {
      nowSaved = !current.ids.includes(id);
      return {
        ...current,
        ids: nowSaved ? [id, ...current.ids] : current.ids.filter((saved) => saved !== id),
      };
    });
    return nowSaved;
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) => ({ ...current, ids: current.ids.filter((saved) => saved !== id) }));
  }, []);

  const clear = useCallback(() => setState(emptyState()), []);

  const value = useMemo<SavedContextValue>(
    () => ({ hydrated, ids: state.ids, count: state.ids.length, isSaved, toggle, remove, clear }),
    [hydrated, state.ids, isSaved, toggle, remove, clear],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedContextValue {
  const value = useContext(SavedContext);
  if (!value) throw new Error('useSaved must be used inside a SavedProvider');
  return value;
}
