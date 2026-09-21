// Which mentorship programs a visitor can join. Sean owns this folder.
//
// The audience answers are read straight from the intake answers on the
// device. They are deliberately not on CareerProfile, so nothing here can leak
// into the match request or into scoring.

import { AUDIENCE_QUESTION_ID } from '../content/questionnaire';
import type { AnswerMap, MentorshipAudience, Opportunity } from '../models';

/** What the visitor said describes them. Empty when they skipped the question. */
export function audiencesFromAnswers(answers: AnswerMap): MentorshipAudience[] {
  const raw = answers[AUDIENCE_QUESTION_ID];
  return Array.isArray(raw) ? (raw as MentorshipAudience[]) : [];
}

/**
 * True when the visitor can join, or when we cannot tell. Someone who skipped
 * the question sees everything, and a program that names no audience is open to
 * anyone. Only a program that names audiences the visitor did not pick is hidden.
 */
export function fitsAudience(item: Opportunity, audiences: MentorshipAudience[]): boolean {
  if (item.kind !== 'mentorship') return true;
  if (audiences.length === 0 || item.audiences.length === 0) return true;
  return item.audiences.some((audience) => audiences.includes(audience));
}
