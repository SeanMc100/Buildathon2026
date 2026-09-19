// Intake state: the answers, persistence, and the derived profile.
// Sean owns this file (app shell). Screens read it through useIntake().
//
// Answers are written to device storage after every change so a half-finished
// questionnaire survives the app being closed, which matters because the whole
// design assumes people can stop and come back.

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

import { QUESTION_BANK, QUESTION_BANK_VERSION } from '../content';
import type {
  AnswerMap,
  AnswerValue,
  CareerProfile,
  IntakeState,
  QuestionId,
} from '../models';
import { buildProfile } from '../matching';
import { prunedAnswers, unansweredRequired, visibleQuestions } from './flow';

const STORAGE_KEY = 'buildathon.intake.v1';

function emptyState(): IntakeState {
  return {
    answers: {},
    skipped: [],
    status: 'not_started',
    updatedAt: new Date().toISOString(),
    version: QUESTION_BANK_VERSION,
  };
}

type IntakeContextValue = {
  /** False until storage has been read. Screens should wait on it. */
  hydrated: boolean;
  state: IntakeState;
  answers: AnswerMap;
  setAnswer: (id: QuestionId, value: AnswerValue) => void;
  clearAnswer: (id: QuestionId) => void;
  skip: (id: QuestionId) => void;
  unskip: (id: QuestionId) => void;
  reset: () => void;
  markComplete: () => void;
  /** Visible questions on the current path, recomputed as answers change. */
  path: ReturnType<typeof visibleQuestions>;
  /** Required questions still outstanding. */
  outstanding: QuestionId[];
  /** Null until at least the priority question has been answered. */
  profile: CareerProfile | null;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

export function IntakeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<IntakeState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // Load once on mount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const saved = JSON.parse(raw) as IntakeState;
          // Drop answers from an older bank rather than scoring them wrongly.
          if (saved.version === QUESTION_BANK_VERSION) setState(saved);
        }
      } catch {
        // A corrupt or unreadable store is not worth blocking the app for;
        // the user starts fresh.
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

  // Persist after hydration, never before, or an empty state would overwrite
  // a saved one on first render.
  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // Losing a write is survivable; the next answer will try again.
    });
  }, [state]);

  const setAnswer = useCallback((id: QuestionId, value: AnswerValue) => {
    setState((current) => {
      const answers = { ...current.answers, [id]: value };
      return {
        ...current,
        // Editing an earlier answer can close a branch. Drop anything that
        // fell off the path so it never reaches scoring.
        answers: prunedAnswers(QUESTION_BANK, answers),
        skipped: current.skipped.filter((skippedId) => skippedId !== id),
        status: current.status === 'complete' ? 'complete' : 'in_progress',
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const clearAnswer = useCallback((id: QuestionId) => {
    setState((current) => {
      const answers = { ...current.answers };
      delete answers[id];
      return {
        ...current,
        answers: prunedAnswers(QUESTION_BANK, answers),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const skip = useCallback((id: QuestionId) => {
    setState((current) => {
      const answers = { ...current.answers };
      delete answers[id];
      return {
        ...current,
        answers: prunedAnswers(QUESTION_BANK, answers),
        skipped: current.skipped.includes(id) ? current.skipped : [...current.skipped, id],
        status: current.status === 'complete' ? 'complete' : 'in_progress',
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const unskip = useCallback((id: QuestionId) => {
    setState((current) => ({
      ...current,
      skipped: current.skipped.filter((skippedId) => skippedId !== id),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const reset = useCallback(() => {
    setState(emptyState());
  }, []);

  const markComplete = useCallback(() => {
    setState((current) => ({
      ...current,
      status: 'complete',
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const path = useMemo(() => visibleQuestions(QUESTION_BANK, state.answers), [state.answers]);

  const outstanding = useMemo(
    () => unansweredRequired(QUESTION_BANK, state.answers, state.skipped),
    [state.answers, state.skipped],
  );

  // Rebuilt whenever an answer changes. Cheap - it is pure arithmetic over a
  // handful of fields - and it keeps the results screen honest about edits.
  const profile = useMemo(() => {
    if (Object.keys(state.answers).length === 0) return null;
    return buildProfile(state.answers, state.skipped);
  }, [state.answers, state.skipped]);

  const value = useMemo<IntakeContextValue>(
    () => ({
      hydrated,
      state,
      answers: state.answers,
      setAnswer,
      clearAnswer,
      skip,
      unskip,
      reset,
      markComplete,
      path,
      outstanding,
      profile,
    }),
    [
      hydrated,
      state,
      setAnswer,
      clearAnswer,
      skip,
      unskip,
      reset,
      markComplete,
      path,
      outstanding,
      profile,
    ],
  );

  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntake(): IntakeContextValue {
  const value = useContext(IntakeContext);
  if (!value) throw new Error('useIntake must be used inside an IntakeProvider');
  return value;
}
