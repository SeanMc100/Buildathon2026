// The intake question bank. Content slice.
//
// Design rules this bank follows (sources in docs/intake-research.md):
//  - 14 required items, one per screen. Completion stays flat under ~15 items
//    and falls off a cliff past it.
//  - Formats are deliberately varied (choice, scale, budget, multi) so nobody
//    can autopilot down a column of identical rows.
//  - Every scale point is labelled, not just the two ends.
//  - The one question that decides ranking is a spend-100-points trade-off,
//    because Likert importance items let a person mark everything "very
//    important" and tell us nothing about what they'd actually give up.
//  - Effort peaks in the middle. The last stretch is fast taps.
//  - Nothing here asks for a protected characteristic. See EXCLUDED_ATTRIBUTES.

import type { Question, Section, SectionId } from '../models';

export const QUESTION_BANK_VERSION = 1;

export const SECTIONS: Record<SectionId, Section> = {
  situation: {
    id: 'situation',
    title: 'Where you are',
    blurb: 'A few basics so we pitch things at the right level.',
  },
  interests: {
    id: 'interests',
    title: 'What pulls you in',
    blurb: 'The kind of work that holds your attention.',
  },
  work_style: {
    id: 'work_style',
    title: 'How you like to work',
    blurb: 'The day-to-day shape of a job you would stay in.',
  },
  values: {
    id: 'values',
    title: 'What you would trade',
    blurb: 'The part that separates a good job from a good job for you.',
  },
  constraints: {
    id: 'constraints',
    title: 'Hard lines',
    blurb: 'Things a match has to respect, not just be nice about.',
  },
  narrative: {
    id: 'narrative',
    title: 'In your words',
    blurb: 'Anything the questions missed.',
  },
};

export const SECTION_ORDER: SectionId[] = [
  'situation',
  'interests',
  'work_style',
  'values',
  'constraints',
  'narrative',
];

export const QUESTION_BANK: Question[] = [
  // ---------------------------------------------------------------- situation
  {
    id: 'stage',
    section: 'situation',
    kind: 'single',
    prompt: 'Which of these sounds most like you right now?',
    why: 'It changes what counts as a good suggestion. Someone changing field needs different ideas than someone climbing in one.',
    options: [
      { value: 'first_role', label: 'Looking for my first real role' },
      { value: 'early', label: 'A few years in, building up' },
      { value: 'mid', label: 'Established, open to something better' },
      { value: 'pivot', label: 'Want to move into a different field' },
      { value: 'returner', label: 'Coming back after time away from work' },
      { value: 'stepping_up', label: 'Ready to lead something bigger' },
    ],
  },
  {
    id: 'focus_area',
    section: 'situation',
    kind: 'text',
    prompt: 'What do you do, or what do you want to do?',
    help: 'A few words is plenty. "Still working it out" is a real answer.',
    placeholder: 'e.g. nursing, data analysis, still working it out',
    maxLength: 120,
    optional: true,
    why: 'Free text gives the model something specific to anchor on. Skipping it just means we lean on everything else.',
  },
  {
    id: 'experience_band',
    section: 'situation',
    kind: 'single',
    prompt: 'How long have you worked in the area you want to stay in or move toward?',
    help: 'Rough is fine. Time away from work does not count against you here.',
    why: 'Used to pitch seniority. We never ask for your age or your graduation year.',
    options: [
      { value: 'none', label: 'Not started yet' },
      { value: 'under_1', label: 'Under a year' },
      { value: '1_3', label: '1 to 3 years' },
      { value: '3_6', label: '3 to 6 years' },
      { value: '6_10', label: '6 to 10 years' },
      { value: '10_plus', label: 'Over 10 years' },
    ],
  },
  {
    id: 'education',
    section: 'situation',
    kind: 'single',
    prompt: 'What is the furthest formal training you have finished?',
    help: 'This sets the range of roles we show. It does not rule anything out.',
    why: 'Maps to how much preparation a role typically expects, so we do not send you roles that need a licence you do not have.',
    options: [
      { value: 'none_required', label: 'No formal qualifications' },
      { value: 'secondary', label: 'School / secondary level' },
      { value: 'certificate', label: 'Certificate, trade or apprenticeship' },
      { value: 'associate', label: 'Associate or diploma' },
      { value: 'bachelor', label: "Bachelor's degree" },
      { value: 'postgraduate', label: "Master's or above" },
    ],
  },

  // ---------------------------------------------------------------- interests
  {
    id: 'interest_pull',
    section: 'interests',
    kind: 'multi',
    prompt: 'Which of these would you happily lose an afternoon to?',
    help: 'Pick two or three.',
    min: 2,
    max: 3,
    why: 'A short read on the kind of activity that holds your attention. It is a hint, not a personality test, and we mark it as such.',
    options: [
      { value: 'R', label: 'Building, fixing or working with your hands', hint: 'tools, machines, outdoors, physical craft' },
      { value: 'I', label: 'Digging into a problem until it cracks', hint: 'research, data, figuring out why' },
      { value: 'A', label: 'Making something that did not exist', hint: 'design, writing, music, visual work' },
      { value: 'S', label: 'Helping someone get somewhere', hint: 'teaching, care, coaching, support' },
      { value: 'E', label: 'Selling an idea and getting people moving', hint: 'pitching, leading, starting things' },
      { value: 'C', label: 'Bringing order to a mess', hint: 'organising, systems, getting details right' },
    ],
  },

  // --------------------------------------------------------------- work_style
  {
    id: 'autonomy',
    section: 'work_style',
    kind: 'scale',
    prompt: 'How much do you want to decide how the work gets done?',
    minLabel: 'Tell me what to do',
    maxLabel: 'Leave me to it',
    labels: [
      'Give me clear instructions and a routine',
      'Mostly guided, some room to choose',
      'An even mix',
      'Mostly my call, check in occasionally',
      'Hand me the goal and get out of the way',
    ],
    why: 'Of everything measured about a job, how much control you have over your own work is the most consistent predictor of whether you stay happy in it.',
  },
  {
    id: 'pace',
    section: 'work_style',
    kind: 'single',
    prompt: 'What pace do you actually want?',
    why: 'Pace is a real filter. A fast-growing company and a steady one are different jobs even with the same title.',
    options: [
      { value: 'steady', label: 'Steady and predictable', hint: 'you know what next week looks like' },
      { value: 'mixed', label: 'Mostly calm with busy stretches' },
      { value: 'intense', label: 'Fast, full, a lot going on' },
    ],
  },
  {
    id: 'deadline_response',
    section: 'work_style',
    kind: 'single',
    prompt: 'A hard deadline lands on your desk. Honestly, what happens?',
    why: 'Pressure that feels like a challenge energises people. Pressure that feels like an obstacle burns them out. Same hours, opposite outcome, so we ask which one you mean.',
    options: [
      { value: 'energised', label: 'I get sharper. I like the pressure.' },
      { value: 'neutral', label: 'Depends entirely on the week.' },
      { value: 'drained', label: 'It wears me down, even when I deliver.' },
    ],
  },
  {
    id: 'variety_vs_depth',
    section: 'work_style',
    kind: 'scale',
    prompt: 'Would you rather go wide or go deep?',
    minLabel: 'One thing, properly',
    maxLabel: 'A bit of everything',
    labels: [
      'Be the person who really knows one thing',
      'Mostly one thing, some range',
      'An even mix',
      'Several things on the go',
      'Something different most days',
    ],
    why: 'Depth and variety pull in opposite directions in most jobs. Knowing which way you lean stops us sending you the wrong shape of role.',
  },
  {
    id: 'team_shape',
    section: 'work_style',
    kind: 'single',
    prompt: 'Who do you want around you?',
    why: 'Who you work next to shows up in job satisfaction research ahead of pay, and it is easy to get wrong when you only read a job title.',
    options: [
      { value: 'solo', label: 'Mostly heads-down on my own' },
      { value: 'small_team', label: 'A small team who know each other well' },
      { value: 'large_org', label: 'A big place with lots of people to learn from' },
    ],
  },

  // ------------------------------------------------------------------- values
  {
    id: 'priority_budget',
    section: 'values',
    kind: 'allocate',
    prompt: 'You have 100 points. Spend them on what your next role has to get right.',
    help: 'Spend all 100. What you give up matters as much as what you pick.',
    total: 100,
    step: 5,
    why: 'Asking "how important is pay?" gets everyone saying "very". Making you spend a fixed budget is the only way to see what you would actually trade away. This is the single biggest input to your match.',
    options: [
      { value: 'pay_and_security', label: 'Pay and security', hint: 'money stops being a worry' },
      { value: 'flexibility_and_balance', label: 'Flexibility and balance', hint: 'the job fits around your life' },
      { value: 'growth_and_learning', label: 'Growth and learning', hint: 'you are better in a year' },
      { value: 'mission_and_impact', label: 'Mission and impact', hint: 'the work matters to you' },
      { value: 'people_and_team', label: 'People and team', hint: 'you like who you work with' },
    ],
  },
  {
    id: 'manager_support',
    section: 'values',
    kind: 'scale',
    prompt: 'How much would you give up elsewhere for a manager who genuinely backs you?',
    minLabel: 'Not a factor',
    maxLabel: 'The whole thing',
    labels: [
      'Nothing. I manage myself.',
      'A little, if everything else held up',
      'Some pay or some title',
      'A lot. It changes how the job feels.',
      'It is the thing I would pick a job on',
    ],
    why: 'Manager quality outranks pay in facet-level satisfaction studies, but only for some people. Framing it as a trade tells us which you are.',
  },

  // -------------------------------------------------------------- constraints
  {
    id: 'arrangement',
    section: 'constraints',
    kind: 'multi',
    prompt: 'Which of these would you take?',
    help: 'Pick everything you would genuinely accept.',
    min: 1,
    why: 'A hard filter. We drop anything that does not fit before we rank anything.',
    options: [
      { value: 'Remote', label: 'Fully remote' },
      { value: 'Hybrid', label: 'Hybrid, a few days in' },
      { value: 'Onsite', label: 'On site, most days' },
    ],
  },
  {
    id: 'commute_limit',
    section: 'constraints',
    kind: 'single',
    prompt: 'How far is too far to travel in?',
    showIf: [{ questionId: 'arrangement', includes: 'Onsite' }],
    optional: true,
    why: 'Used only as a distance filter. We never use where you live to score you.',
    options: [
      { value: '20', label: 'Under 20 minutes' },
      { value: '45', label: 'Up to 45 minutes' },
      { value: '60', label: 'Up to an hour' },
      { value: '90', label: 'Over an hour is fine' },
      { value: 'relocate', label: 'I would move for the right thing' },
    ],
  },
  {
    id: 'employment_type',
    section: 'constraints',
    kind: 'multi',
    prompt: 'What kind of arrangement works?',
    min: 1,
    options: [
      { value: 'FullTime', label: 'Full time' },
      { value: 'PartTime', label: 'Part time' },
      { value: 'Contract', label: 'Contract' },
      { value: 'Freelance', label: 'Freelance or self-employed' },
      { value: 'Internship', label: 'Internship or placement' },
      { value: 'Apprenticeship', label: 'Apprenticeship or trainee' },
    ],
  },
  {
    id: 'pay_stance',
    section: 'constraints',
    kind: 'single',
    prompt: 'Where does pay need to land for money to stop being a stressor?',
    help: 'We only ask what you need going forward. We never ask what you earn now.',
    why: 'Pay level barely correlates with job satisfaction, but not being able to cover your life does. So we ask about the floor, not the ceiling.',
    options: [
      { value: 'flexible', label: 'I have room to move if the rest is right' },
      { value: 'market', label: 'Around the going rate for the work' },
      { value: 'top_of_market', label: 'Toward the top end. Pay is the point.' },
      { value: 'has_floor', label: 'There is a number I cannot go under' },
    ],
  },
  {
    id: 'pay_floor_band',
    section: 'constraints',
    kind: 'single',
    prompt: 'Roughly where is that floor?',
    help: 'Annual, before tax. A band is enough.',
    showIf: [{ questionId: 'pay_stance', equals: 'has_floor' }],
    optional: true,
    options: [
      { value: '25000', label: 'Around 25k' },
      { value: '40000', label: 'Around 40k' },
      { value: '60000', label: 'Around 60k' },
      { value: '85000', label: 'Around 85k' },
      { value: '120000', label: 'Around 120k' },
      { value: '160000', label: '160k or above' },
    ],
  },
  {
    id: 'dealbreakers',
    section: 'constraints',
    kind: 'multi',
    prompt: 'Anything here you are not willing to do?',
    help: 'Pick any that apply, or skip.',
    optional: true,
    why: 'These become hard filters. Everything you rule out here is removed before anything is ranked.',
    options: [
      { value: 'night_shifts', label: 'Nights or weekend shifts' },
      { value: 'heavy_travel', label: 'Regular travel away from home' },
      { value: 'on_call', label: 'Being on call' },
      { value: 'sales_targets', label: 'Cold outreach or sales targets' },
      { value: 'managing_people', label: 'Managing people' },
      { value: 'physical_work', label: 'Physically demanding work' },
      { value: 'high_stakes', label: 'High-stakes or high-pressure environments' },
    ],
  },

  // ---------------------------------------------------------------- narrative
  {
    id: 'extra_context',
    section: 'narrative',
    kind: 'text',
    prompt: 'Anything else someone would need to know to point you at the right thing?',
    help: 'Optional. Constraints, a dream, a thing you are done with.',
    placeholder: 'Type whatever matters. Or skip it.',
    maxLength: 600,
    multiline: true,
    optional: true,
    why: 'Goes to the model word for word. It is the one place you are not choosing from a list.',
  },
];

/**
 * Stated on the results screen and sent with every request, so the model is
 * told plainly what it does not have and does not try to infer it.
 * These are protected characteristics under US employment law (Title VII, ADA,
 * ADEA, GINA) and handling them here would make a high-risk system under the
 * EU AI Act. Salary history is separately restricted in many jurisdictions.
 */
export const EXCLUDED_ATTRIBUTES = [
  'race_or_ethnicity',
  'sex_gender_or_sexual_orientation',
  'religion',
  'national_origin_or_immigration_status',
  'age_or_date_of_birth',
  'disability_or_health_status',
  'genetic_or_family_medical_information',
  'pregnancy_marital_or_family_status',
  'salary_history',
  'criminal_history',
  'home_address_or_postcode',
] as const;

export function questionById(id: string): Question | undefined {
  return QUESTION_BANK.find((question) => question.id === id);
}
