// Topic vocabulary for matching. Matching slice.
//
// One small keyword set does three jobs, so a person's words and the catalog's
// words are compared on the same footing:
//   1. Tags every opportunity with the cause themes it works on.
//   2. Reads the free-text "what do you do?" answer for the same themes.
//   3. Reduces both sides to word stems so "nursing" finds "Registered Nurses".
//
// Deliberately simple and inspectable. Nothing here calls out to a model, and
// every score can be traced to a word on the page.

import type { CauseTheme, Opportunity } from '../models';

export const CAUSE_THEMES: CauseTheme[] = [
  'health',
  'education',
  'community',
  'technology',
  'business',
  'trades',
  'creative',
  'environment',
];

/** Reads after "Works on", e.g. "Works on health and care." */
export const CAUSE_LABELS: Record<CauseTheme, string> = {
  health: 'health and care',
  education: 'learning and young people',
  community: 'neighborhoods and public service',
  technology: 'technology',
  business: 'business and finance',
  trades: 'building, making and moving things',
  creative: 'culture and design',
  environment: 'the environment and energy',
};

/**
 * Word-start patterns per theme, matched against lower-cased text. A pattern
 * counts once however often it repeats, so a page that says "community" ten
 * times is not ten times as community-minded as one that says it once.
 */
const THEME_PATTERNS: Record<CauseTheme, RegExp[]> = {
  health: [
    /\bhealth/, /\bmedic/, /\bclinic/, /\bnurs(e|es|ing)\b/, /\bpatient/, /\bhospital/,
    /\bdental|\bdentist/, /\btherap/, /\bpharm/, /\bcaregiv|\bcare giver/, /\bwellness/,
    /\bmental\b/, /\bsurg/, /\bphysician|\bdoctor/, /\bradiolog/, /\bparamedic|\bemt\b/,
    /\bbehavioral/, /\bhygien/, /\bphlebotom/, /\bbiomedic/, /\bnutrition/,
  ],
  education: [
    /\bteach/, /\beducator/, /\bschool/, /\btutor/, /\bclassroom/, /\byouth/, /\bcurricul/,
    /\bliteracy/, /\bearly childhood|\bchild ?care/, /\bk-12\b/, /\bged\b/, /\binstructor/,
    /\bcounselor|\bcounsellor/, /\bmentor/, /\bafter-?school/,
  ],
  community: [
    /\bcommunit/, /\bneighbo/, /\bhousing/, /\bnon-?profit/, /\bsocial (work|service)/,
    /\bpublic (service|safety|administration|sector|policy)/, /\bcivic/, /\badvocacy|\badvocate/,
    /\bequity|\bjustice/, /\brefugee|\bimmigra/, /\bfood (bank|access|security)/,
    /\bshelter/, /\boutreach/, /\bgovernment|\bmunicipal|\bcity of\b/, /\bpolicy/,
    /\bpolice|\bfire ?fight/, /\bvolunteer/,
  ],
  technology: [
    /\bsoftware/, /\bdevelop(er|ers|ment)\b/, /\bprogram(mer|mers|ming)\b/, /\bcoding|\bcoder/,
    /\bcyber/, /\bdata (scien|analy|engineer)|\bdata\b/, /\banalytics/, /\binformation (tech|system)/,
    /\bcomputer/, /\bnetwork(ing)? (admin|engineer|security)|\bit support|\bhelp ?desk/,
    /\bcloud\b/, /\bai\b|\bartificial intell/, /\bmachine learning/, /\brobot/, /\bautomation/,
    /\bdigital/, /\bweb\b/, /\bapp(lication)? develop/, /\bhackathon/, /\btech\b|\btechnology\b/,
  ],
  business: [
    /\bbusiness/, /\bentrepreneur/, /\bstart-?up/, /\bfinanc/, /\baccount(ant|ing|ants)\b/,
    /\bbank/, /\binvest/, /\bmarketing/, /\bsales/, /\bretail/, /\bmanagement|\bmanager/,
    /\bcommerce/, /\bprocurement|\bpurchasing/, /\bbookkeep/, /\bcustomer/, /\badministrative/,
    /\bhuman resources|\brecruit/, /\bconsult/, /\binsurance/, /\breal estate/, /\bpublic relations/,
  ],
  trades: [
    /\bmanufactur/, /\bconstruct/, /\bweld/, /\belectric(ian|ians|al)?\b/, /\bplumb/, /\bcarpent/,
    /\bmachin(e|ist|ists|ing)\b/, /\bmechanic/, /\bautomotive|\bauto\b/, /\bassembl/, /\bhvac\b/,
    /\bskilled trade|\btrades\b|\bapprentice/, /\boperator/, /\bmaintenance/,
    /\btruck|\bdriver/, /\bwarehouse/, /\blogistic/, /\baviation|\baircraft/, /\bfabricat/,
    /\btool and die|\bcnc\b/, /\brepair/, /\binstall/, /\bindustrial/,
  ],
  creative: [
    /\bdesign/, /\bart\b|\bartist|\barts\b/, /\bcreative/, /\bmusic/, /\bfilm|\bvideo/, /\bmedia\b/,
    /\bwriter|\bwriting|\bauthor/, /\bjournalis/, /\bphotograph/, /\bfashion/, /\btheat(er|re)/,
    /\bcultur/, /\bmuseum/, /\banimation|\billustrat/, /\bbrand(ing)?\b/, /\bpublishing/,
    /\bstudio/, /\bentertain/, /\bgraphic/,
  ],
  environment: [
    /\benvironment/, /\bsustainab/, /\benergy/, /\bsolar/, /\bwind (turbine|energy|power)/,
    /\bclimate/, /\bconservation/, /\bwater\b/, /\brecycl/, /\bgreen\b/, /\bforest/,
    /\bagricultur|\bfarm/, /\becolog/, /\butilit(y|ies)\b/, /\bhorticult|\blandscap/,
  ],
};

/** Program sector tags are structural evidence, stronger than a stray keyword. */
const PROGRAM_SECTOR_THEME: Record<string, CauseTheme> = {
  healthcare: 'health',
  tech: 'technology',
  skilled_trades: 'trades',
  manufacturing: 'trades',
  transport_logistics: 'trades',
  entrepreneurship: 'business',
  creative: 'creative',
  adult_education: 'education',
};

type Text = { title: string; body: string };

function textOf(opportunity: Opportunity): Text {
  const body: string[] = [opportunity.summary, opportunity.organization];

  if (opportunity.kind === 'job' && opportunity.detroit) {
    body.push(opportunity.detroit.sector, ...opportunity.detroit.entryRoutes);
  }
  if (opportunity.kind === 'program' && opportunity.program) {
    body.push(opportunity.program.sector.replace(/_/g, ' '), ...opportunity.program.credentials);
  }
  if (opportunity.kind === 'research') {
    body.push(opportunity.field, ...(opportunity.research?.disciplines ?? []));
  }

  return { title: opportunity.title.toLowerCase(), body: body.join(' ').toLowerCase() };
}

// ---- Word stems -------------------------------------------------------------

const SUFFIXES = ['ations', 'ation', 'ians', 'ian', 'ists', 'ist', 'ers', 'er', 'ing', 'ies', 'es', 'ed', 's', 'e', 'y'];

/**
 * A crude stem: strip one common ending, keep the first five letters. Loose on
 * purpose. "nursing", "nurse" and "Nurses" all become "nurs"; "analysis",
 * "analyst" and "analytics" all become "analy".
 */
export function stem(word: string): string {
  let out = word.toLowerCase();
  for (const suffix of SUFFIXES) {
    if (out.endsWith(suffix) && out.length - suffix.length >= 3) {
      out = out.slice(0, -suffix.length);
      break;
    }
  }
  return out.slice(0, 5);
}

const wordsOf = (text: string) => text.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);

// ---- Opportunity side ---------------------------------------------------------

type Tagged = {
  themes: Record<CauseTheme, number>;
  titleStems: Set<string>;
  bodyStems: Set<string>;
};

const tagCache = new WeakMap<Opportunity, Tagged>();

function tag(opportunity: Opportunity): Tagged {
  const cached = tagCache.get(opportunity);
  if (cached) return cached;

  const { title, body } = textOf(opportunity);
  const themes = {} as Record<CauseTheme, number>;

  for (const theme of CAUSE_THEMES) {
    const inTitle = THEME_PATTERNS[theme].filter((pattern) => pattern.test(title)).length;
    const inBody = THEME_PATTERNS[theme].filter((pattern) => pattern.test(body)).length;
    // A title hit says what the thing is. A body hit says it touches the theme.
    themes[theme] = Math.min(1, (inTitle + 0.5 * inBody) / 1.5);
  }

  if (opportunity.kind === 'program' && opportunity.program) {
    const structural = PROGRAM_SECTOR_THEME[opportunity.program.sector];
    if (structural) themes[structural] = Math.max(themes[structural], 0.9);
  }

  const tagged: Tagged = {
    themes,
    titleStems: new Set(wordsOf(title).map(stem)),
    bodyStems: new Set(wordsOf(body).map(stem)),
  };
  tagCache.set(opportunity, tagged);
  return tagged;
}

/** 0..1 for each theme: how squarely this opportunity works on it. */
export function themeStrengths(opportunity: Opportunity): Record<CauseTheme, number> {
  return tag(opportunity).themes;
}

// ---- Person side ----------------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'want', 'wanna', 'like', 'love',
  'work', 'working', 'works', 'job', 'jobs', 'career', 'careers', 'role', 'roles', 'field', 'area',
  'still', 'out', 'figuring', 'figure', 'something', 'anything', 'everything', 'not', 'sure',
  'idk', 'unsure', 'maybe', 'some', 'kind', 'sort', 'doing', 'become', 'get', 'getting', 'help',
  'helping', 'people', 'person', 'other', 'good', 'new', 'more', 'any', 'all', 'undecided',
  'currently', 'previously', 'looking', 'try', 'trying', 'start', 'starting', 'open', 'pretty',
  'much', 'very', 'just', 'stuff', 'things', 'thing', 'what', 'not', 'yet', 'know', 'don',
]);

export type FocusQuery = {
  /** Stems of the words the person typed that carry meaning. */
  stems: string[];
  /** Themes their words point at, e.g. "nursing" -> health. */
  themes: CauseTheme[];
};

/** Null when the answer is empty or says "I don't know yet": nothing to match on. */
export function parseFocus(text: string | null): FocusQuery | null {
  if (!text) return null;
  const lowered = text.toLowerCase();

  const stems = Array.from(
    new Set(wordsOf(lowered).filter((word) => !STOPWORDS.has(word)).map(stem)),
  );
  const themes = CAUSE_THEMES.filter((theme) => THEME_PATTERNS[theme].some((p) => p.test(lowered)));

  return stems.length === 0 && themes.length === 0 ? null : { stems, themes };
}

/**
 * How an opportunity relates to what the person said they do, in two parts:
 *   words  the person's own words found on the listing. A word in the title is
 *          the strongest evidence, a word in the body a weaker one.
 *   theme  a shared theme (nursing -> any health role), a graded fallback so
 *          related work still ranks above unrelated work.
 */
export function focusMatch(opportunity: Opportunity, query: FocusQuery): { words: number; theme: number } {
  const tagged = tag(opportunity);

  // The best word leads and the average tempers it, so "welding or electrician"
  // still finds Electricians (one of two words) while "data analysis" still
  // prefers a listing that has both.
  const perWord: number[] = query.stems.map((item) =>
    tagged.titleStems.has(item) ? 1 : tagged.bodyStems.has(item) ? 0.6 : 0,
  );
  const words =
    perWord.length === 0 ? 0 : 0.6 * Math.max(...perWord) + 0.4 * (perWord.reduce((a, b) => a + b, 0) / perWord.length);

  return { words, theme: Math.max(0, ...query.themes.map((theme) => tagged.themes[theme])) };
}

/** 0..1: a direct word match counts in full, a shared theme at three quarters. */
export function focusFit(opportunity: Opportunity, query: FocusQuery): number {
  const { words, theme } = focusMatch(opportunity, query);
  return Math.max(words, 0.75 * theme);
}
