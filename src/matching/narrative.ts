// The plain-language synthesis. Matching slice.
//
// This string is shown to the user and sent to the model as an anchor. It is
// written from the derived profile only, so it can never claim something the
// structured fields do not support. Anything the user skipped is simply left
// out of the sentence rather than filled in.

import type {
  CareerProfile,
  CareerStage,
  EducationLevel,
  ExperienceBand,
  RiasecCode,
} from '../models';
import { CAUSE_LABELS } from './topics';

const STAGE_PHRASE: Record<CareerStage, string> = {
  FirstRole: 'looking for a first real role',
  EarlyCareer: 'a few years in and building up',
  MidCareer: 'established and open to something better',
  Pivot: 'trying to move into a different field',
  Returner: 'coming back after time away from work',
  SteppingUp: 'ready to lead something bigger',
};

const EXPERIENCE_PHRASE: Record<ExperienceBand, string> = {
  none: 'no experience in it yet',
  under_1: 'under a year of experience',
  '1_3': 'one to three years of experience',
  '3_6': 'three to six years of experience',
  '6_10': 'six to ten years of experience',
  '10_plus': 'over ten years of experience',
};

const EDUCATION_PHRASE: Record<EducationLevel, string> = {
  none_required: 'no formal qualifications',
  secondary: 'school-level education',
  certificate: 'a certificate, trade or apprenticeship',
  associate: 'an associate or diploma',
  bachelor: "a bachelor's degree",
  postgraduate: 'a postgraduate degree',
};

const INTEREST_PHRASE: Record<RiasecCode, string> = {
  R: 'building and fixing things',
  I: 'digging into hard problems',
  A: 'making things that did not exist',
  S: 'helping people get somewhere',
  E: 'pitching ideas and getting people moving',
  C: 'bringing order to a mess',
};

const STRENGTH_PHRASE: Record<RiasecCode, string> = {
  R: 'getting practical things done',
  I: 'working out how and why things happen',
  A: 'original ideas',
  S: 'listening and helping them through something',
  E: 'persuading people and getting a group moving',
  C: 'keeping things accurate and on schedule',
};

const EXCLUSION_PHRASE: Record<string, string> = {
  night_shifts: 'nights or weekend shifts',
  heavy_travel: 'regular travel',
  on_call: 'being on call',
  sales_targets: 'sales targets',
  managing_people: 'managing people',
  physical_work: 'physically demanding work',
  high_stakes: 'high-pressure environments',
};

function joinList(items: string[], conjunction = 'and'): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

function autonomyPhrase(value: number): string {
  if (value >= 80) return 'wants to be handed the goal and left alone';
  if (value >= 60) return 'wants most decisions to be their own call';
  if (value >= 40) return 'wants a mix of direction and independence';
  if (value >= 20) return 'is happiest with clear guidance';
  return 'wants clear instructions and a routine';
}

function varietyPhrase(value: number): string {
  if (value >= 70) return 'prefers range over specialism';
  if (value <= 30) return 'would rather go deep on one thing';
  return 'wants a mix of depth and range';
}

export function buildNarrative(profile: CareerProfile): string {
  const sentences: string[] = [];

  // 1. Who they are right now. Anything unanswered is left out of the sentence
  // rather than filled in with a default the model would read as stated fact.
  const opener = profile.focusArea
    ? `Someone ${STAGE_PHRASE[profile.stage.value]} in ${profile.focusArea}`
    : `Someone ${STAGE_PHRASE[profile.stage.value]}`;
  const background: string[] = [];
  if (profile.experienceBand) background.push(EXPERIENCE_PHRASE[profile.experienceBand]);
  if (profile.educationLevel) background.push(EDUCATION_PHRASE[profile.educationLevel]);
  sentences.push(
    background.length > 0 ? `${opener}, with ${joinList(background)}.` : `${opener}.`,
  );

  // 2. What they love, what they are good at, and what they want it to serve.
  // Three of the four Ikigai circles, in their own words; the fourth (what pays)
  // is the priority budget below.
  const { enjoys, strengths } = profile.interests;
  if (enjoys.length > 0) {
    sentences.push(`Drawn to ${joinList(enjoys.map((code) => INTEREST_PHRASE[code]))}.`);
  }
  if (strengths.length > 0) {
    sentences.push(`People come to them for ${joinList(strengths.map((code) => STRENGTH_PHRASE[code]))}.`);
  }
  if (profile.causes.value.length > 0) {
    sentences.push(
      `They want their work to serve ${joinList(profile.causes.value.map((theme) => CAUSE_LABELS[theme]))}.`,
    );
  }

  // 3. The shape of the working day.
  const style = profile.workStyle;
  const styleParts = [autonomyPhrase(style.autonomy.value), varietyPhrase(style.variety.value)];
  if (style.teamShape.sourceQuestionIds.length > 0) {
    styleParts.push(
      style.teamShape.value === 'Solo'
        ? 'works best heads-down alone'
        : style.teamShape.value === 'SmallTeam'
          ? 'wants a small team who know each other'
          : 'wants a large organisation with people to learn from',
    );
  }
  if (style.pace.sourceQuestionIds.length > 0) {
    styleParts.push(
      style.pace.value === 'Intense'
        ? 'is after a fast, full pace'
        : style.pace.value === 'Steady'
          ? 'wants a steady, predictable pace'
          : 'wants mostly calm work with busy stretches',
    );
  }
  sentences.push(`${capitalise(joinList(styleParts))}.`);

  // 4. Pressure. This one distinction changes what to send them.
  if (style.challengeAppetite.sourceQuestionIds.length > 0) {
    sentences.push(
      style.challengeAppetite.value === 'Energised'
        ? 'Deadline pressure sharpens them rather than wearing them down, so demanding roles are on the table.'
        : style.challengeAppetite.value === 'Drained'
          ? 'Deadline pressure wears them down even when they deliver, so avoid roles that run on permanent urgency.'
          : 'Their response to deadline pressure depends on the week.',
    );
  }

  // 5. What they would actually trade, in their own budget.
  if (profile.priorities.length > 0) {
    const top = profile.priorities
      .slice(0, 3)
      .map((item) => `${item.label.toLowerCase()} (${item.weight})`);
    const bottom = profile.priorities[profile.priorities.length - 1];
    sentences.push(
      `Given 100 points to spend, they put the most on ${joinList(top)}, and the least on ${bottom.label.toLowerCase()}.`,
    );
  }

  // 6. The lines a match has to respect.
  const constraints = profile.hardConstraints;
  const hardParts: string[] = [];
  if (constraints.minSalaryUsd !== null) {
    hardParts.push(`a floor of about ${formatMoney(constraints.minSalaryUsd)}`);
  } else if (constraints.payStance === 'top_of_market') {
    hardParts.push('pay toward the top of the market');
  }
  if (hardParts.length > 0) sentences.push(`Hard lines: ${joinList(hardParts)}.`);

  if (constraints.exclusions.length > 0) {
    const ruled = constraints.exclusions.map((key) => EXCLUSION_PHRASE[key] ?? key);
    sentences.push(`Ruled out entirely: ${joinList(ruled)}.`);
  }

  // 7. Be honest about how much of this is guesswork.
  if (profile.completeness < 0.8) {
    sentences.push(
      `Only ${Math.round(profile.completeness * 100)}% of the questionnaire was answered, so treat the weaker signals lightly.`,
    );
  }

  return sentences.join(' ');
}

function capitalise(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

function formatMoney(amount: number): string {
  return amount >= 1000 ? `${Math.round(amount / 1000)}k` : String(amount);
}
