// Pure flow logic for the intake questionnaire: which questions are visible,
// where the user is, and whether an answer counts as complete.
// No React, no storage - safe to unit test and safe to call from anywhere.

import type {
  AnswerMap,
  AnswerValue,
  Question,
  QuestionId,
  VisibilityRule,
} from '../models';

function asArray(value: AnswerValue | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
}

function rulePasses(rule: VisibilityRule, answers: AnswerMap): boolean {
  const value = answers[rule.questionId];
  if (rule.equals !== undefined && value !== rule.equals) return false;
  if (rule.notEquals !== undefined && value === rule.notEquals) return false;
  if (rule.includes !== undefined && !asArray(value).includes(rule.includes)) return false;
  return true;
}

/** A question is shown only when every one of its rules passes. */
export function isVisible(question: Question, answers: AnswerMap): boolean {
  if (!question.showIf || question.showIf.length === 0) return true;
  return question.showIf.every((rule) => rulePasses(rule, answers));
}

/**
 * The questions currently on the path, in bank order. Recomputed on every
 * answer, so branching questions appear and disappear as the user edits.
 */
export function visibleQuestions(bank: Question[], answers: AnswerMap): Question[] {
  return bank.filter((question) => isVisible(question, answers));
}

/** Whether a given value satisfies the question's own rules. */
export function isAnswered(question: Question, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;

  switch (question.kind) {
    case 'single':
      return typeof value === 'string' && value.length > 0;
    case 'multi': {
      const picked = asArray(value);
      const min = question.min ?? 1;
      return picked.length >= min;
    }
    case 'rank': {
      const picked = asArray(value);
      return picked.length === question.take;
    }
    case 'scale':
      return typeof value === 'number' && value >= 1 && value <= question.labels.length;
    case 'allocate': {
      if (typeof value !== 'object' || Array.isArray(value)) return false;
      const spent = Object.values(value).reduce((sum, n) => sum + n, 0);
      return spent === question.total;
    }
    case 'text':
      return typeof value === 'string' && value.trim().length > 0;
    default:
      return false;
  }
}

/** True when the user may move on: answered, skipped, or marked optional. */
export function canAdvance(
  question: Question,
  value: AnswerValue | undefined,
  skipped: QuestionId[],
): boolean {
  if (question.optional) return true;
  if (skipped.includes(question.id)) return true;
  return isAnswered(question, value);
}

export type Progress = {
  /** 1-based position on the current path. */
  index: number;
  total: number;
  /** 0..1, for the progress bar. */
  ratio: number;
  /** How many of the visible questions have a real answer. */
  answered: number;
};

export function progressFor(
  bank: Question[],
  answers: AnswerMap,
  questionId: QuestionId,
): Progress {
  const path = visibleQuestions(bank, answers);
  const position = path.findIndex((question) => question.id === questionId);
  const answered = path.filter((question) => isAnswered(question, answers[question.id])).length;
  const total = path.length || 1;
  return {
    index: position < 0 ? 0 : position + 1,
    total: path.length,
    ratio: Math.min(1, answered / total),
    answered,
  };
}

/** The next question after `questionId` on the current path, or null at the end. */
export function nextQuestion(
  bank: Question[],
  answers: AnswerMap,
  questionId: QuestionId,
): Question | null {
  const path = visibleQuestions(bank, answers);
  const position = path.findIndex((question) => question.id === questionId);
  if (position < 0) return path[0] ?? null;
  return path[position + 1] ?? null;
}

export function previousQuestion(
  bank: Question[],
  answers: AnswerMap,
  questionId: QuestionId,
): Question | null {
  const path = visibleQuestions(bank, answers);
  const position = path.findIndex((question) => question.id === questionId);
  if (position <= 0) return null;
  return path[position - 1] ?? null;
}

/** Ids of visible, non-optional questions with no answer and no explicit skip. */
export function unansweredRequired(
  bank: Question[],
  answers: AnswerMap,
  skipped: QuestionId[],
): QuestionId[] {
  return visibleQuestions(bank, answers)
    .filter((question) => !question.optional)
    .filter((question) => !skipped.includes(question.id))
    .filter((question) => !isAnswered(question, answers[question.id]))
    .map((question) => question.id);
}

/** Answers for questions that are no longer on the path, so scoring ignores them. */
export function prunedAnswers(bank: Question[], answers: AnswerMap): AnswerMap {
  const live = new Set(visibleQuestions(bank, answers).map((question) => question.id));
  const next: AnswerMap = {};
  for (const [id, value] of Object.entries(answers)) {
    if (live.has(id)) next[id] = value;
  }
  return next;
}
