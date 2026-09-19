// Typed, forgiving readers for the raw answer map. Matching slice.
// Every reader tolerates a missing or skipped answer, because the whole flow
// lets people skip.

import type { AnswerMap, AnswerValue, QuestionId } from '../models';

export function readString(answers: AnswerMap, id: QuestionId): string | null {
  const value = answers[id];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function readList(answers: AnswerMap, id: QuestionId): string[] {
  const value = answers[id];
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

export function readNumber(answers: AnswerMap, id: QuestionId): number | null {
  const value = answers[id];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readAllocation(answers: AnswerMap, id: QuestionId): Record<string, number> {
  const value: AnswerValue | undefined = answers[id];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) out[key] = amount;
  }
  return out;
}

/** Maps a 1..points scale answer onto 0..100. Returns null when unanswered. */
export function scaleToPercent(
  answers: AnswerMap,
  id: QuestionId,
  points: number,
): number | null {
  const raw = readNumber(answers, id);
  if (raw === null || points < 2) return null;
  const clamped = Math.min(Math.max(raw, 1), points);
  return Math.round(((clamped - 1) / (points - 1)) * 100);
}
