// Reads the facts a training provider actually printed on the page.
//
// The rule everywhere in here: say nothing rather than guess. Every function
// returns null unless the page states the thing plainly, and every number has to
// sit next to a word that says what it is ("tuition", "stipend", "week"). A bare
// "$5,000" on a page about grants is not a tuition figure, so it is ignored.
//
// These are deliberately readable keyword rules, like scripts/events/enrich.ts:
// the point is that every value in data/programs.json can be traced back to a
// sentence on the page. Swapping this for a model call later means keeping the
// same signatures and the same "null when unstated" discipline.

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, eighteen: 18,
  twenty: 20, twentyfour: 24, thirty: 30, forty: 40,
};

const count = (word: string): number | null => {
  const digits = Number(word.replace(/,/g, ''));
  if (Number.isFinite(digits)) return digits;
  return NUMBER_WORDS[word.toLowerCase().replace(/[\s-]/g, '')] ?? null;
};

const NUM = `(\\d{1,3}|${Object.keys(NUMBER_WORDS).join('|')})`;

/** Nouns that mean "this sentence is describing the programme itself". */
const PROGRAM_NOUN = String.raw`program(?:me)?|course|cohort|training|class|boot ?camp|apprenticeship|academy|curriculum|session|internship|fellowship|track|pathway|commitment`;

/** "a six-week cohort", "12-week program", "eight week course". */
const LENGTH_THEN_NOUN = new RegExp(String.raw`${NUM}[\s-]?(week|month|year)s?[\s,-]*(?:long[\s,-]*)?(?:${PROGRAM_NOUN})`, 'gi');

/** "the program runs 10 weeks", "training takes about six months". */
const NOUN_THEN_LENGTH = new RegExp(
  String.raw`(?:${PROGRAM_NOUN})[^.
]{0,40}?(?:is|lasts|runs|takes|spans)\s+(?:about|approximately|roughly|around)?\s*${NUM}\s*(week|month|year)s?`,
  'gi',
);

/** "between two and five months" is a range, not a length. */
const RANGE_BEFORE = /(?:between|from|and|or|to)\s*$/i;

function toWeeks(amount: number, unit: string): number | null {
  if (amount <= 0) return null;
  if (unit === 'week') return amount > 260 ? null : amount;
  if (unit === 'month') return amount > 60 ? null : Math.round(amount * 4.345);
  return amount > 6 ? null : amount * 52;
}

/**
 * "six-week cohort", "the program runs 12 weeks", "nine-month training".
 * Months and years are converted (a month is 4.345 weeks, rounded) because the
 * shared model only has durationWeeks.
 *
 * Deliberately strict. The number has to sit against a word naming the programme,
 * a range ("between two and five months") is refused, and a page that states two
 * different lengths — TechTown's Retail Boot Camp runs a 4-week and a 12-week
 * edition off one page — returns null rather than picking one.
 */
export function readDurationWeeks(text: string): number | null {
  const found = new Set<number>();

  for (const pattern of [LENGTH_THEN_NOUN, NOUN_THEN_LENGTH]) {
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(Math.max(0, (match.index ?? 0) - 12), match.index ?? 0);
      if (RANGE_BEFORE.test(before)) continue;
      const amount = count(match[1]);
      const weeks = amount === null ? null : toWeeks(amount, match[2].toLowerCase());
      if (weeks !== null) found.add(weeks);
    }
  }

  return found.size === 1 ? [...found][0] : null;
}

// ---- Cost -------------------------------------------------------------------

const FREE = /\b(?:tuition[-\s]?free|free of charge|at no cost|no cost to (?:you|participants?|students?|the participant)|no tuition|100% free|completely free|free (?:job )?training|free to (?:you|participants?|Detroiters|Detroit residents))\b/i;
const COST_LABEL = /(?:tuition|cost|price|fee|investment|program fee)[^.$\n]{0,25}\$\s*([\d,]+(?:\.\d{2})?)/i;
const DOLLARS_THEN_LABEL = /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per (?:person|participant|student)\s*)?(?:total\b|tuition|program fee|course fee)/i;
/** "any project that will cost over $600" is not a tuition figure. */
const COMPARISON = /\b(?:over|under|more than|less than|up to|at least|exceeds?|worth|as much as|starting at|from)\b/i;

export type Money = { amountUsd: number | null; note: string | null };

/** 0 when the page says free, a figure when it labels one, null otherwise. */
export function readCost(text: string): Money {
  if (FREE.test(text)) return { amountUsd: 0, note: FREE.exec(text)?.[0] ?? null };

  const labelled = DOLLARS_THEN_LABEL.exec(text) ?? COST_LABEL.exec(text);
  if (labelled && !COMPARISON.test(labelled[0])) {
    const amount = Number(labelled[1].replace(/,/g, ''));
    if (Number.isFinite(amount) && amount > 0 && amount < 200000) {
      return { amountUsd: amount, note: labelled[0].replace(/\s+/g, ' ').trim() };
    }
  }
  // "Contact us for pricing" and friends: worth saying on the card, not worth a number.
  const vague = /\b(?:sliding scale|pay what you can|contact us for (?:pricing|cost)|scholarships? (?:are )?available|payment plans?)\b/i.exec(text);
  return { amountUsd: null, note: vague?.[0] ?? null };
}

const STIPEND = new RegExp(
  `(?:stipend|paid (?:training|apprenticeship)|earn while you learn)[^.$\\n]{0,60}\\$\\s*([\\d,]+)|\\$\\s*([\\d,]+)[^.\\n]{0,30}(?:stipend|weekly stipend|per week while)`,
  'i',
);

/** Only a figure the page ties to the word "stipend" or "paid training" counts. */
export function readStipend(text: string): Money {
  const match = STIPEND.exec(text);
  if (match) {
    const amount = Number((match[1] ?? match[2]).replace(/,/g, ''));
    if (Number.isFinite(amount) && amount > 0 && amount < 100000) {
      return { amountUsd: amount, note: match[0].replace(/\s+/g, ' ').trim() };
    }
  }
  const paid = /\b(?:paid (?:training|internship|apprenticeship|fellowship)|earn while you learn|receive a stipend|stipend[s]? (?:are |is )?(?:available|provided))\b/i.exec(text);
  return { amountUsd: null, note: paid?.[0] ?? null };
}

// ---- Dates ------------------------------------------------------------------

const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';

/** Only dates that carry their own year. Guessing the year invents a cohort. */
function parseDate(fragment: string): string | null {
  const written = new RegExp(`\\b(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, 'i').exec(fragment);
  if (written) {
    const parsed = new Date(`${written[1]} ${written[2]}, ${written[3]} UTC`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(fragment);
  if (numeric) {
    const parsed = new Date(Date.UTC(Number(numeric[3]), Number(numeric[1]) - 1, Number(numeric[2])));
    if (!Number.isNaN(parsed.getTime()) && parsed.getUTCMonth() === Number(numeric[1]) - 1) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return null;
}

const STARTS = /\b(?:cohort|class|program|session|training|next (?:cohort|class|session))\s+(?:begins?|starts?|kicks? off|commences?)\b[^.\n]{0,60}|\b(?:start date|begins on|starting)\b[^.\n]{0,60}/i;
const DEADLINE = /\b(?:appl(?:ications?|y)\s+(?:close[sd]?|due|deadline|by)|deadline(?: to apply)?|submit by|apply by|closes? on)\b[^.\n]{0,60}/i;

const DATEISH = new RegExp(`\\d|\\b(?:${MONTHS}|spring|summer|fall|autumn|winter|quarterly|monthly|weekly)\\b`, 'i');

/** "starting" turns up in ordinary prose, so a note has to carry a date-ish word. */
const keepNote = (phrase: string) => (DATEISH.test(phrase) ? phrase.replace(/\s+/g, ' ').trim() : null);

/** An ISO date only when the page labels it as a start, and only when it is still ahead. */
export function readStartsAt(text: string, now: Date): { value: string | null; note: string | null } {
  const phrase = STARTS.exec(text)?.[0];
  if (!phrase) return { value: null, note: null };
  const date = parseDate(phrase);
  const tidy = keepNote(phrase);
  if (!date) return { value: null, note: tidy };
  // A date already gone is not the next cohort; keep the wording, drop the date.
  return Date.parse(`${date}T23:59:59Z`) >= now.getTime() ? { value: date, note: null } : { value: null, note: tidy };
}

export function readApplyBy(text: string, now: Date): { value: string | null; note: string | null } {
  const phrase = DEADLINE.exec(text)?.[0];
  if (!phrase) return { value: null, note: null };
  const date = parseDate(phrase);
  const tidy = keepNote(phrase);
  if (!date) return { value: null, note: tidy };
  return Date.parse(`${date}T23:59:59Z`) >= now.getTime() ? { value: date, note: null } : { value: null, note: tidy };
}

// ---- Eligibility ------------------------------------------------------------

const ELIGIBILITY_LINE = /^(?:you must|must be|open to|eligibility|eligible|applicants? must|participants? must|to qualify|requirements?|who (?:can|should) apply|be at least|18 (?:years|\+)|candidates? must)\b/i;
const ELIGIBILITY_INLINE = /\b(?:must be (?:at least )?\d{2}(?:\+| years old| or older)|open to (?:all )?[a-z][^.\n]{5,80}|Detroit residents? (?:only|aged)[^.\n]{0,60}|high school diploma or (?:GED|equivalent)[^.\n]{0,40}|no (?:prior )?experience (?:is )?(?:required|necessary)|U\.S\. work authorization[^.\n]{0,40})/gi;

/** A heading ("Eligibility:") is not a requirement; a sentence is. */
const usable = (line: string) =>
  line.length >= 16 &&
  line.length <= 180 &&
  line.split(/\s+/).length >= 4 &&
  !/^(?:requirements?|eligibility|eligible|who (?:can|should) apply)\b[:.]?$/i.test(line);

/** Plain-language requirement lines, as the page words them. */
export function readEligibility(text: string): string[] {
  const found: string[] = [];

  for (const line of text.split(/\n+/)) {
    const tidy = line.replace(/\s+/g, ' ').trim().replace(/^[-•*]\s*/, '');
    if (usable(tidy) && ELIGIBILITY_LINE.test(tidy)) found.push(tidy);
  }
  for (const match of text.replace(/\n+/g, ' ').matchAll(ELIGIBILITY_INLINE)) {
    const tidy = match[0].replace(/\s+/g, ' ').trim();
    if (usable(tidy)) found.push(tidy);
  }

  const seen = new Set<string>();
  return found
    .filter((line) => {
      const key = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

// ---- Credentials, supports, format, funding, how to apply -------------------

const CREDENTIALS: Array<[string, RegExp]> = [
  ['CDL-A', /\bCDL[\s-]?A\b|class a (?:commercial driver|cdl)/i],
  ['CDL-B', /\bCDL[\s-]?B\b|class b (?:commercial driver|cdl)/i],
  ['CompTIA A+', /\bcomptia a\+|\ba\+ certification/i],
  ['CompTIA Network+', /network\+/i],
  ['CompTIA Security+', /security\+/i],
  ['AWS certification', /\bAWS\b[^.\n]{0,40}certif|aws re\/?start/i],
  ['Google certificate', /google (?:career )?certificate/i],
  ['Salesforce Administrator', /salesforce administrator/i],
  ['CNA / Nurse Aide', /\bCNA\b|certified nursing assistant|nurse aide/i],
  ['Patient Care Technician', /patient care technician/i],
  ['Medical Assistant', /medical assistant/i],
  ['Phlebotomy', /phlebotom/i],
  ['Pharmacy Technician (PTCB)', /pharmacy tech|PTCB/i],
  ['Dental Assisting', /dental assist/i],
  ['OSHA 10', /\bOSHA[\s-]?10\b/i],
  ['OSHA 30', /\bOSHA[\s-]?30\b/i],
  ['Welding (MIG/TIG/Arc)', /\b(?:MIG|TIG|arc) weld|welding certif/i],
  ['CNC machining', /\bCNC\b/i],
  ['Forklift', /forklift|hi[\s-]?lo\b/i],
  ['EPA 608 / HVAC', /\bEPA\s?608\b|\bHVAC\b/i],
  ['Michigan Builders License', /builders? licen[cs]e/i],
  ['GED / high school completion', /\bGED\b|high school (?:equivalency|completion|diploma) program/i],
  ['ServSafe', /servsafe/i],
  ['Registered apprenticeship', /registered apprenticeship|journey(?:man|worker)/i],
];

export function readCredentials(text: string): string[] {
  return CREDENTIALS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name).slice(0, 6);
}

type Support = 'childcare' | 'transport' | 'stipend' | 'tools_or_equipment' | 'job_placement' | 'housing' | 'meals';

const SUPPORTS: Array<[Support, RegExp]> = [
  ['childcare', /child ?care|day ?care/i],
  ['transport', /transportation (?:assistance|support|is provided|stipend)|bus (?:pass|card|tickets)|gas cards?|help with transportation/i],
  ['stipend', /stipend|paid (?:training|internship|apprenticeship|fellowship)|earn while you learn|weekly pay/i],
  ['tools_or_equipment', /tools? (?:are )?provided|work boots|safety gear|laptop (?:is )?provided|equipment (?:is )?provided|uniforms? (?:are )?provided/i],
  ['job_placement', /job placement|placement (?:assistance|support|services)|help(?:s|ing)? you find (?:a job|work)|career coach|employment services|connect(?:ed)? (?:you )?(?:with|to) employers/i],
  ['housing', /housing (?:assistance|support|is provided)/i],
  ['meals', /meals? (?:are )?(?:provided|included)|lunch (?:is )?provided/i],
];

export function readSupports(text: string): Support[] {
  return SUPPORTS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

export function readDelivery(text: string): 'in_person' | 'online' | 'hybrid' | 'unknown' {
  const online = /\b(?:online|virtual(?:ly)?|remote(?:ly)?|via zoom|livestream|distance learning)\b/i.test(text);
  const inPerson = /\b(?:in[-\s]person|on[-\s]?site|classroom|our (?:campus|shop|facility|training center)|hands[-\s]on lab)\b/i.test(text);
  if (/\bhybrid\b/i.test(text) || (online && inPerson)) return 'hybrid';
  if (online) return 'online';
  if (inPerson) return 'in_person';
  return 'unknown';
}

export function readFunding(text: string, costUsd: number | null): 'free_to_participant' | 'wioa_funded' | 'employer_sponsored' | 'paid_training' | 'tuition' | 'scholarship_available' | 'unknown' {
  if (/\bWIOA\b|workforce innovation and opportunity act|funded (?:by|through) Detroit at Work|Michigan Works!? (?:funding|funded)/i.test(text)) return 'wioa_funded';
  if (/\b(?:paid (?:training|apprenticeship|fellowship)|earn while you learn)\b/i.test(text)) return 'paid_training';
  if (/\bemployer[-\s](?:sponsored|paid)|your employer (?:applies|pays)|businesses apply\b/i.test(text)) return 'employer_sponsored';
  if (costUsd === 0) return 'free_to_participant';
  if (/scholarships? (?:are )?available|financial aid|need[-\s]based award/i.test(text)) return 'scholarship_available';
  if (costUsd !== null && costUsd > 0) return 'tuition';
  return 'unknown';
}

export function readApplicationMethod(text: string): 'online_form' | 'phone' | 'email' | 'in_person' | 'info_session' | 'unknown' {
  if (/\b(?:info(?:rmation)? session|orientation|open house|discovery call|ask an expert)\b/i.test(text)) return 'info_session';
  if (/\bappl(?:y|ication)\b[^.\n]{0,40}\b(?:online|here|now|form|portal)\b|\bstart your application|\bsubmit an application\b/i.test(text)) return 'online_form';
  if (/\bcall (?:us )?(?:at )?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\bgive us a call\b/i.test(text)) return 'phone';
  if (/\bemail (?:us )?(?:at )?[\w.+-]+@[\w.-]+/i.test(text)) return 'email';
  if (/\bvisit (?:a|our) (?:career center|campus|office)|\bstop by\b|\bwalk[-\s]?in\b/i.test(text)) return 'in_person';
  return 'unknown';
}

export function readCadence(text: string): 'rolling' | 'cohort' | 'continuous' | 'annual' | 'unknown' {
  if (/\brolling (?:admissions?|basis|enrollment)|apply (?:any ?time|year[-\s]?round)|open enrollment\b/i.test(text)) return 'rolling';
  if (/\b(?:each|every) (?:summer|year|spring|fall)|annual(?:ly)? program|once a year\b/i.test(text)) return 'annual';
  if (/\bcohort|next class|class (?:starts|begins)|sessions? (?:start|begin)\b/i.test(text)) return 'cohort';
  if (/\b(?:year[-\s]?round|ongoing|continuous(?:ly)?|drop[-\s]?in)\b/i.test(text)) return 'continuous';
  return 'unknown';
}
