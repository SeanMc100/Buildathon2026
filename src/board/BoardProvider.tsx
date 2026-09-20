// Bulletin board state: which boards the member joined, plus their chat
// messages and posts. Sean owns this file (app shell).
//
// Everything is saved on the device. That is a demo stand-in: two phones do not
// see each other's messages until this provider is pointed at a shared backend.
// Screens only talk to useBoard(), so that swap stays inside this file.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { BOARDS_BY_ID, SAMPLE_MESSAGES, SAMPLE_POSTS } from '../content';
import type { BoardMessage, BoardPost, BoardPostInput, BoardState } from '../models';
import { LIMITS } from './validate';

const STORAGE_KEY = 'buildathon.board.v1';
const STATE_VERSION = 1;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState(): BoardState {
  return {
    version: STATE_VERSION,
    memberId: makeId('member'),
    handle: `Member ${1000 + Math.floor(Math.random() * 9000)}`,
    joined: [],
    messages: [],
    posts: [],
  };
}

const byNewest = (a: { postedAt: string }, b: { postedAt: string }) =>
  b.postedAt.localeCompare(a.postedAt);

type BoardContextValue = {
  /** False until storage has been read. */
  hydrated: boolean;
  memberId: string;
  handle: string;
  joined: string[];
  isJoined: (boardId: string) => boolean;
  /** Joining an age board swaps out any other age board. */
  join: (boardId: string) => void;
  leave: (boardId: string) => void;
  /** Oldest first, so a chat reads top to bottom. */
  messagesFor: (boardId: string) => BoardMessage[];
  /** Newest first. */
  postsFor: (boardId: string) => BoardPost[];
  /** False when the board is not joined or the text is empty. */
  sendMessage: (boardId: string, body: string) => boolean;
  submitPost: (boardId: string, input: BoardPostInput) => boolean;
};

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BoardState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const saved = JSON.parse(raw) as BoardState;
          if (saved.version === STATE_VERSION) setState(saved);
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

  // Persist only after hydration so an empty state never overwrites a saved one.
  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // A lost write is survivable; the next change will try again.
    });
  }, [state]);

  const join = useCallback((boardId: string) => {
    const board = BOARDS_BY_ID.get(boardId);
    if (!board) return;
    setState((current) => {
      if (current.joined.includes(boardId)) return current;
      const kept =
        board.category === 'age'
          ? current.joined.filter((id) => BOARDS_BY_ID.get(id)?.category !== 'age')
          : current.joined;
      return { ...current, joined: [...kept, boardId] };
    });
  }, []);

  const leave = useCallback((boardId: string) => {
    setState((current) => ({
      ...current,
      joined: current.joined.filter((id) => id !== boardId),
    }));
  }, []);

  const sendMessage = useCallback(
    (boardId: string, body: string) => {
      const text = body.trim().slice(0, LIMITS.message);
      if (!text || !state.joined.includes(boardId)) return false;
      setState((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            id: makeId('msg'),
            boardId,
            authorId: current.memberId,
            authorHandle: current.handle,
            body: text,
            postedAt: new Date().toISOString(),
            isSample: false,
          },
        ],
      }));
      return true;
    },
    [state.joined],
  );

  const submitPost = useCallback(
    (boardId: string, input: BoardPostInput) => {
      if (!state.joined.includes(boardId)) return false;
      setState((current) => ({
        ...current,
        posts: [
          ...current.posts,
          {
            ...input,
            id: makeId('post'),
            boardId,
            authorId: current.memberId,
            authorHandle: current.handle,
            postedAt: new Date().toISOString(),
            isSample: false,
          },
        ],
      }));
      return true;
    },
    [state.joined],
  );

  const messagesFor = useCallback(
    (boardId: string) =>
      [...SAMPLE_MESSAGES, ...state.messages]
        .filter((message) => message.boardId === boardId)
        .sort((a, b) => a.postedAt.localeCompare(b.postedAt)),
    [state.messages],
  );

  const postsFor = useCallback(
    (boardId: string) =>
      [...SAMPLE_POSTS, ...state.posts].filter((post) => post.boardId === boardId).sort(byNewest),
    [state.posts],
  );

  const value = useMemo<BoardContextValue>(
    () => ({
      hydrated,
      memberId: state.memberId,
      handle: state.handle,
      joined: state.joined,
      isJoined: (boardId) => state.joined.includes(boardId),
      join,
      leave,
      messagesFor,
      postsFor,
      sendMessage,
      submitPost,
    }),
    [hydrated, state.memberId, state.handle, state.joined, join, leave, messagesFor, postsFor, sendMessage, submitPost],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard(): BoardContextValue {
  const value = useContext(BoardContext);
  if (!value) throw new Error('useBoard must be used inside a BoardProvider');
  return value;
}
