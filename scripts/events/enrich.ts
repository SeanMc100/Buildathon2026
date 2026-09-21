// Turns a RawEvent into an EventOpportunity: decides whether it is relevant to
// someone building a career, and fills the match tags (Holland code, the seven
// trait scores, format) that no feed publishes.
//
// This is a keyword pass, deliberately simple and readable so every tag can be
// explained. It is the piece to swap for an LLM call later: same input, same
// EventOpportunity out, and everything around it stays put.

import { createHash } from 'node:crypto';

import type { EventFormat, EventOpportunity, PreferenceTrait, RiasecCode } from '../../src/models';
import { metroCity } from './region';
import type { RawEvent } from './types';

export type Assessment =
  /** Every event that has not ended is kept; relevance only decides how it is tagged and ranked. */
  | { keep: true; opportunity: EventOpportunity; careerRelevant: boolean }
  | { keep: false; reason: string };

// ---- Signals ----------------------------------------------------------------

/** Groups of words that say an event is useful to someone working on their career. */
const CAREER_SIGNALS: Record<string, RegExp> = {
  networking: /network|mixer|meet-?up|happy hour|founders?\b|social hour|community night/i,
  learning: /workshop|training|boot ?camp|masterclass|skills|certif|office hours|clinic|class\b|webinar|learn/i,
  talk: /summit|panel|keynote|fireside|forum|conference|symposium|speaker|lecture/i,
  hiring: /career fair|job fair|hiring|recruit|career|apprentice|internship/i,
  startup: /startup|pitch|entrepreneur|venture|accelerator|demo day|showcase|innovation|buildathon|hackathon|business|funding/i,
  tech: /\bai\b|artificial intelligence|software|\bdata\b|engineer|developer|cyber|mobility|hardware|robotic|manufactur|biotech|research|\bstem\b|\btech\b/i,
};

/** Social or entertainment events. Not career-relevant unless other signals outweigh this. */
const ENTERTAINMENT = /release party|runway|fashion show|concert|\bdj\b|album|gallery opening|brunch|comedy|nightclub|birthday|wedding|\bparty\b|photo ?walk|foto walk|open house|\b5k\b|\bgala\b|golf|fundrais|auction/i;

const HOLLAND_KEYWORDS: Record<RiasecCode, RegExp> = {
  R: /hardware|manufactur|mobility|automotive|maker|robotic|engineer|trades|construction|\bbuild/i,
  I: /\bai\b|artificial intelligence|\bdata\b|research|science|software|cyber|analytics|biotech|developer|\bcode\b/i,
  A: /design|creative|\bart\b|media|film|photo|music|fashion|brand|content/i,
  S: /community|workshop|mentor|coaching|nonprofit|education|health|support|training|youth|food/i,
  E: /startup|pitch|founder|entrepreneur|venture|business|sales|invest|leadership|innovation|showcase/i,
  C: /finance|accounting|compliance|operations|logistics|supply chain|tax|legal|budget|process/i,
};

const MISSION = /community|nonprofit|policy|civic|equity|access|forum|social impact|neighborhood/i;
const MENTORING = /mentor|coaching|office hours|advis/i;

// ---- Helpers ----------------------------------------------------------------

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function detectSignals(text: string): string[] {
  return Object.entries(CAREER_SIGNALS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

function chooseFormat(signals: string[], text: string): EventFormat {
  if (/\b(career|job|hiring|recruiting) (fair|expo|event)\b/i.test(text)) return 'career_fair';
  if (/summit|conference|symposium/i.test(text)) return 'conference';
  if (signals.includes('learning')) return 'workshop';
  if (signals.includes('talk')) return 'talk';
  // Pitch nights, showcases and pop-ups are about meeting people more than sitting through a talk.
  return 'networking';
}

function chooseHolland(text: string): RiasecCode[] {
  const hits = (Object.keys(HOLLAND_KEYWORDS) as RiasecCode[])
    .map((code) => ({ code, count: (text.match(new RegExp(HOLLAND_KEYWORDS[code], 'gi')) ?? []).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((entry) => entry.code);

  if (hits.length > 0) return hits;
  // No interest signal at all: claim none, so the event does not drift up for anyone.
  return [];
}

function chooseTraits(signals: string[], format: EventFormat, text: string, isOnline: boolean): Record<PreferenceTrait, number> {
  const has = (name: string) => signals.includes(name);
  return {
    pay_and_security: clamp(35 + (has('hiring') ? 35 : 0) + (has('startup') ? 10 : 0)),
    flexibility_and_balance: isOnline ? 85 : 40,
    growth_and_learning: clamp(
      40 + (has('learning') ? 35 : 0) + (has('talk') ? 20 : 0) + (format === 'conference' ? 15 : 0) + (has('tech') ? 10 : 0),
    ),
    mission_and_impact: clamp(35 + (MISSION.test(text) ? 30 : 0)),
    people_and_team: clamp(
      40 + (has('networking') ? 40 : 0) + (format === 'conference' ? 15 : 0) + (has('hiring') ? 20 : 0) + (has('talk') ? 10 : 0) + (format === 'workshop' ? 15 : 0),
    ),
    manager_support: MENTORING.test(text) ? 70 : 40,
    autonomy: 50,
  };
}

/** A line that is only a date, time or price, which feeds often put first. */
const SCHEDULE_LINE = /^(?:[A-Za-z]+day,?\s+)?[A-Za-z.]+\s+\d{1,2}(?:,\s*\d{4})?\s*(?:[|–-].*)?$|^\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)/i;

/** Where-and-how notes ("This session will be held in-person at…") say nothing about the event. */
const LOGISTICS_LINE = /^this (session|event|workshop|program) (will be|is) (held|hosted)|^registration (opens|is)|^doors open|^hosted by\b/i;

function summarize(raw: RawEvent, format: EventFormat): string {
  // Work paragraph by paragraph, so a schedule line does not become the summary.
  const body = raw.description
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    // Some feeds repeat the event title at the start of the description.
    .map((line) => (line.startsWith(raw.title) ? line.slice(raw.title.length).replace(/^[\s\d|:–—-]+/, '') : line))
    .find((line) => line.length >= 30 && !SCHEDULE_LINE.test(line) && !LOGISTICS_LINE.test(line));

  if (body) {
    // A period after an abbreviation (U.S., Inc.) does not end the sentence.
    const sentence = /^(.{30,220}?(?<!\bU\.S|\bSept|\bInc|\bDr|\bMr|\bMs|\bSt|\bvs)[.!?])(\s|$)/.exec(body)?.[1];
    if (sentence) return sentence;
    return body.length > 200 ? `${body.slice(0, 200).trimEnd()}…` : body;
  }

  const kind = format.replace('_', ' ');
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} hosted by ${raw.organizer}${raw.location ? ` at ${raw.location}` : ''}.`;
}

function shortLocation(raw: RawEvent): string | null {
  if (raw.isOnline) return null;
  // Street addresses are noisy on a card: keep the venue name and the city.
  const venue = raw.location?.split(',')[0]?.trim();
  const city = metroCity(raw.city);
  return [venue, city].filter(Boolean).join(', ') || null;
}

// ---- Public -----------------------------------------------------------------

export function assessEvent(raw: RawEvent, now: Date): Assessment {
  const endMs = Date.parse(raw.endsAt ?? raw.startsAt);
  if (endMs < now.getTime()) return { keep: false, reason: 'already ended' };

  const text = `${raw.title} ${raw.description} ${raw.organizer}`;
  const found = detectSignals(text);
  const social = ENTERTAINMENT.test(raw.title);

  // Events with nothing career-related about them are still listed, but tagged
  // neutrally, so they sit at the bottom of every ranking instead of vanishing.
  const careerRelevant = found.length > 0 && !(social && found.length < 2);
  const signals = careerRelevant ? found : [];

  const format = chooseFormat(signals, text);
  const digest = createHash('sha1').update(`${raw.source}:${raw.sourceId}`).digest('hex').slice(0, 10);

  const opportunity: EventOpportunity = {
    id: `event-${raw.source}-${digest}`,
    kind: 'event',
    title: raw.title,
    organization: raw.organizer,
    summary: summarize(raw, format),
    url: raw.url,
    location: shortLocation(raw),
    hollandCode: careerRelevant ? chooseHolland(text) : [],
    traits: chooseTraits(signals, format, text, raw.isOnline),
    jobZone: null,
    minEducation: 'none_required',
    suitableStages: [],
    demands: [],
    verifiedOn: now.toISOString().slice(0, 10),
    isSample: false,
    format,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    costUsd: raw.costUsd,
  };

  return { keep: true, opportunity, careerRelevant };
}
