// Questionnaire primitives. Sean owns this file; it is the contract between
// the content slice (which authors questions) and the screens + matching slices
// (which render and score them). Mirrors docs/schema.json.

export type QuestionId = string;

export type SectionId =
  | 'situation'
  | 'interests'
  | 'work_style'
  | 'values'
  | 'constraints'
  | 'narrative';

export type Section = {
  id: SectionId;
  title: string;
  /** One line shown above the first question of the section. */
  blurb: string;
};

export type ChoiceOption = {
  value: string;
  label: string;
  /** Short clarifier shown under the label. Keep to one line. */
  hint?: string;
};

/**
 * Data-driven branching so the content owner can author skips without code.
 * A question is shown when every rule passes.
 */
export type VisibilityRule = {
  questionId: QuestionId;
  /** Answer must equal this value. */
  equals?: string;
  /** Answer must not equal this value. */
  notEquals?: string;
  /** Multi/rank answer must contain this value. */
  includes?: string;
};

type BaseQuestion = {
  id: QuestionId;
  section: SectionId;
  /** The question itself, in plain language. */
  prompt: string;
  /** Optional supporting line under the prompt. */
  help?: string;
  /** Shown behind a "why are you asking?" tap. Transparency is a design rule. */
  why?: string;
  /** Skippable questions never block progress. */
  optional?: boolean;
  showIf?: VisibilityRule[];
};

/** Pick exactly one option. */
export type SingleChoiceQuestion = BaseQuestion & {
  kind: 'single';
  options: ChoiceOption[];
};

/** Pick between `min` and `max` options. */
export type MultiChoiceQuestion = BaseQuestion & {
  kind: 'multi';
  options: ChoiceOption[];
  min?: number;
  max?: number;
};

/**
 * A labelled N-point scale. Every point carries its own label: fully-labelled
 * scales are measurably more reliable than endpoint-only ones.
 */
export type ScaleQuestion = BaseQuestion & {
  kind: 'scale';
  /** One label per point, low to high. Length defines the number of points. */
  labels: string[];
  /** Optional captions for the two ends of the axis. */
  minLabel?: string;
  maxLabel?: string;
};

/** Spend a fixed budget across options. Forces real trade-offs. */
export type AllocationQuestion = BaseQuestion & {
  kind: 'allocate';
  options: ChoiceOption[];
  total: number;
  step: number;
};

/** Order the top `take` options from a list. */
export type RankQuestion = BaseQuestion & {
  kind: 'rank';
  options: ChoiceOption[];
  take: number;
};

/** Free text, used to give the model raw voice rather than scored signal. */
export type TextQuestion = BaseQuestion & {
  kind: 'text';
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
};

export type Question =
  | SingleChoiceQuestion
  | MultiChoiceQuestion
  | ScaleQuestion
  | AllocationQuestion
  | RankQuestion
  | TextQuestion;

export type QuestionKind = Question['kind'];

/** single -> string, multi/rank -> string[], scale -> number, allocate -> map, text -> string */
export type AnswerValue = string | string[] | number | Record<string, number>;

export type AnswerMap = Record<QuestionId, AnswerValue>;

export type IntakeStatus = 'not_started' | 'in_progress' | 'complete';

export type IntakeState = {
  answers: AnswerMap;
  /** Question ids the user explicitly skipped. Distinct from never-reached. */
  skipped: QuestionId[];
  status: IntakeStatus;
  /** ISO timestamp of the last write. */
  updatedAt: string;
  /** Bumped when the question bank changes shape, so stale answers can be dropped. */
  version: number;
};
