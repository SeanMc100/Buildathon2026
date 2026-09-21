// The intake question bank. Content slice.
//
// Design rules this bank follows (sources in docs/intake-research.md):
//  - 8 required items, one per screen. Completion stays flat under ~15 items
//    and falls off a cliff past it. Paths run 11 to 14 screens.
//  - Formats are deliberately varied (choice, scale, budget, multi) so nobody
//    can autopilot down a column of identical rows.
//  - Every scale point is labelled, not just the two ends.
//  - The one question that decides ranking is a spend-100-points trade-off,
//    because Likert importance items let a person mark everything "very
//    important" and tell us nothing about what they'd actually give up.
//  - Effort peaks in the middle. The last stretch is fast taps.
//  - Age, gender and the age-branch questions (under 25, 25 to 34) are optional
//    and kept on the profile only. Nothing in matching reads them, and they
//    never reach the match request. See EXCLUDED_ATTRIBUTES for what the model
//    is told it does not have.

import type { Question, Section, SectionId } from '../models';

// Bumped to 2 when age, gender and the age branches were added, so saved v1 answers reset.
// Bumped to 3 for the Ikigai rework: strengths and cause questions added, work
// arrangement and commute dropped.
export const QUESTION_BANK_VERSION = 3;

export const SECTIONS: Record<SectionId, Section> = {
  situation: {
    id: 'situation',
    title: 'Where you are',
    blurb: 'A few basics.',
  },
  interests: {
    id: 'interests',
    title: 'What you love',
    blurb: 'Work that holds your attention.',
  },
  strengths: {
    id: 'strengths',
    title: 'What you are good at',
    blurb: 'What people already come to you for.',
  },
  purpose: {
    id: 'purpose',
    title: 'What the world needs',
    blurb: 'The kind of problem you would want to point your work at.',
  },
  work_style: {
    id: 'work_style',
    title: 'How you like to work',
    blurb: 'The shape of a job you would stay in.',
  },
  values: {
    id: 'values',
    title: 'What it has to give you',
    blurb: 'Money, time, growth, meaning: what your next role has to get right.',
  },
  constraints: {
    id: 'constraints',
    title: 'Hard lines',
    blurb: 'What a match has to respect.',
  },
  narrative: {
    id: 'narrative',
    title: 'In your words',
    blurb: 'Anything the questions missed.',
  },
  about_you: {
    id: 'about_you',
    title: 'About you',
    blurb: 'Optional. Nothing here changes your match scores.',
  },
};

export const SECTION_ORDER: SectionId[] = [
  'situation',
  'interests',
  'strengths',
  'purpose',
  'work_style',
  'values',
  'constraints',
  'narrative',
  'about_you',
];

/** The optional "which describe you" question. Read on the device by src/catalog/audience.ts. */
export const AUDIENCE_QUESTION_ID = 'audiences';

export const QUESTION_BANK: Question[] = [
  // ---------------------------------------------------------------- situation
  {
    id: 'stage',
    section: 'situation',
    kind: 'single',
    prompt: 'Which of these sounds most like you right now?',
    why: 'Someone changing field needs different ideas than someone climbing in one.',
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
    help: 'A few words is plenty.',
    placeholder: 'e.g. nursing, data analysis, still working it out',
    maxLength: 120,
    optional: true,
    why: 'Your words are matched against each listing, so this is the most direct signal you give. Skip it and we lean on your other answers.',
  },
  {
    id: 'education',
    section: 'situation',
    kind: 'single',
    prompt: 'What is the furthest formal training you have finished?',
    help: 'Sets the range of roles we show.',
    why: 'So we do not send you roles that need a licence you do not have.',
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
    why: 'What you enjoy, in the order you tap. Your first pick counts most. A hint, not a personality test.',
    options: [
      { value: 'R', label: 'Building, fixing or working with your hands', hint: 'tools, machines, outdoors, physical craft' },
      { value: 'I', label: 'Digging into a problem until it cracks', hint: 'research, data, figuring out why' },
      { value: 'A', label: 'Making something that did not exist', hint: 'design, writing, music, visual work' },
      { value: 'S', label: 'Helping someone get somewhere', hint: 'teaching, care, coaching, support' },
      { value: 'E', label: 'Selling an idea and getting people moving', hint: 'pitching, leading, starting things' },
      { value: 'C', label: 'Bringing order to a mess', hint: 'organising, systems, getting details right' },
    ],
  },

  // ---------------------------------------------------------------- strengths
  // Enjoying something and being good at it are different things, and the
  // overlap is the strongest signal we can get from two taps. Same six
  // dimensions as interest_pull, phrased as what other people see in you.
  {
    id: 'strengths',
    section: 'strengths',
    kind: 'multi',
    prompt: 'What do people come to you for?',
    help: 'Pick two or three. Think of what friends, family or coworkers ask you to do.',
    min: 2,
    max: 3,
    why: 'Where what you enjoy and what you are good at overlap is where we look first. Your first pick counts most.',
    options: [
      { value: 'R', label: 'Getting practical things done', hint: 'fixing, building, setting up, making it work' },
      { value: 'I', label: 'Working out how or why something happens', hint: 'analysing, researching, troubleshooting' },
      { value: 'A', label: 'Coming up with original ideas', hint: 'a way to say it, show it or design it' },
      { value: 'S', label: 'Listening and helping people through something', hint: 'patient, easy to talk to, good at explaining' },
      { value: 'E', label: 'Persuading people and getting a group moving', hint: 'confident, organised, comfortable in charge' },
      { value: 'C', label: 'Keeping things accurate and on schedule', hint: 'careful, reliable, good with details and systems' },
    ],
  },

  // ------------------------------------------------------------------ purpose
  {
    id: 'cause_pull',
    section: 'purpose',
    kind: 'multi',
    prompt: 'What would you most like your work to improve?',
    help: 'Pick one to three.',
    min: 1,
    max: 3,
    why: 'Matched against what each listing actually does, so a role in a field you care about ranks above an identical one you do not.',
    options: [
      { value: 'health', label: 'People’s health and care', hint: 'clinics, hospitals, mental health, wellbeing' },
      { value: 'education', label: 'Learning and young people’s futures', hint: 'schools, tutoring, youth programs' },
      { value: 'community', label: 'Neighborhoods, housing and fairness', hint: 'nonprofits, public service, advocacy' },
      { value: 'technology', label: 'How technology works for people', hint: 'software, data, security, automation' },
      { value: 'business', label: 'Local businesses and good jobs', hint: 'starting, running, finance, sales, marketing' },
      { value: 'trades', label: 'Things that get built, made and moved', hint: 'construction, manufacturing, auto, logistics' },
      { value: 'creative', label: 'Culture, stories and design', hint: 'media, arts, brand, entertainment' },
      { value: 'environment', label: 'The environment and energy', hint: 'clean energy, water, sustainability' },
    ],
  },

  // --------------------------------------------------------------- work_style
  {
    id: 'weekly_hours',
    section: 'work_style',
    kind: 'single',
    prompt: 'How many hours a week do you want to work?',
    help: 'Roughly.',
    showIf: [{ questionId: 'age_band', equals: '55_plus' }],
    why: 'Kept on your profile only. Not scored, not sent to matching.',
    options: [
      { value: 'under_20', label: 'Under 20 hours', hint: 'a few days or short days' },
      { value: '20_30', label: '20 to 30 hours', hint: 'part time, most weeks' },
      { value: '30_40', label: '30 to 40 hours', hint: 'close to full time' },
      { value: '40_plus', label: '40 hours or more', hint: 'full time and beyond' },
      { value: 'depends', label: 'It depends on the role' },
    ],
  },
  {
    id: 'variety_vs_depth',
    section: 'work_style',
    kind: 'scale',
    prompt: 'Do you prefer to focus on one thing, or work across many?',
    minLabel: 'One thing, properly',
    maxLabel: 'A bit of everything',
    labels: [
      'Be the person who really knows one thing',
      'Mostly one thing, some range',
      'An even mix',
      'Several things on the go',
      'Something different most days',
    ],
    why: 'Depth and variety pull opposite ways in most jobs.',
  },

  // ------------------------------------------------------------------- values
  {
    id: 'priority_budget',
    section: 'values',
    kind: 'allocate',
    showIf: [{ questionId: 'age_band', notEquals: '55_plus' }],
    prompt: 'You have 100 points. Spend them on what your next role has to get right.',
    help: 'Spend all 100.',
    total: 100,
    step: 5,
    why: 'A fixed budget shows what you would actually trade away. It is one of the biggest inputs to your match.',
    options: [
      { value: 'pay_and_security', label: 'Pay and security', hint: 'money stops being a worry' },
      { value: 'flexibility_and_balance', label: 'Flexibility and balance', hint: 'the job fits around your life' },
      { value: 'growth_and_learning', label: 'Growth and learning', hint: 'you are better in a year' },
      { value: 'mission_and_impact', label: 'Mission and impact', hint: 'the work matters to you' },
      { value: 'people_and_team', label: 'People and team', hint: 'you like who you work with' },
    ],
  },

  // -------------------------------------------------------------- constraints
  {
    id: 'pay_stance',
    section: 'constraints',
    kind: 'single',
    prompt: 'Where does pay need to land for money to stop being a stressor?',
    help: 'We never ask what you earn now.',
    why: 'We ask about your floor, not your ceiling.',
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
    help: 'Annual, before tax.',
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

  // --------------------------------------------------------------- about you
  // Asked last, on purpose. These are the most personal questions in the bank
  // and the only ones matching never reads, so asking them first spent a
  // visitor's patience on answers that do nothing for them. By the time they
  // appear, every question that shapes a match has been answered.
  {
    id: 'gender',
    section: 'about_you',
    kind: 'single',
    prompt: 'How do you describe your gender?',
    help: 'Optional.',
    optional: true,
    why: 'Kept on your profile only. Not scored, not sent to matching.',
    options: [
      { value: 'woman', label: 'Woman' },
      { value: 'man', label: 'Man' },
      { value: 'non_binary', label: 'Non-binary' },
      { value: 'self_describe', label: 'Something else' },
      { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'age_band',
    section: 'about_you',
    kind: 'single',
    prompt: 'Which age range are you in?',
    help: 'Optional.',
    optional: true,
    why: 'Kept on your profile only. Not scored, not sent to matching.',
    options: [
      { value: 'under_25', label: 'Under 25' },
      { value: '25_34', label: '25 to 34' },
      { value: '35_44', label: '35 to 44' },
      { value: '45_54', label: '45 to 54' },
      { value: '55_plus', label: '55 or over' },
      { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  },
  // Age branch, under 25: same three-question shape as the 25 to 34 branch.
  {
    id: 'under25_now',
    section: 'about_you',
    kind: 'single',
    prompt: 'What are you mostly doing right now?',
    optional: true,
    showIf: [{ questionId: 'age_band', equals: 'under_25' }],
    why: 'Kept on your profile only. Not scored, not sent to matching.',
    options: [
      { value: 'studying', label: 'Studying full time' },
      { value: 'studying_working', label: 'Studying and working' },
      { value: 'working', label: 'Working' },
      { value: 'looking', label: 'Looking for a first start' },
    ],
  },
  {
    id: 'under25_evidence',
    section: 'about_you',
    kind: 'multi',
    prompt: 'What can you already point to?',
    help: 'Pick any.',
    optional: true,
    showIf: [{ questionId: 'age_band', equals: 'under_25' }],
    why: 'Kept on your profile only. Not scored, not sent to matching.',
    options: [
      { value: 'part_time_job', label: 'A part-time or summer job' },
      { value: 'internship', label: 'An internship or placement' },
      { value: 'volunteering', label: 'Volunteering, clubs or teams' },
      { value: 'projects', label: 'Projects or coursework' },
      { value: 'nothing_yet', label: 'Nothing yet' },
    ],
  },
  {
    id: 'under25_next',
    section: 'about_you',
    kind: 'single',
    prompt: 'What do you want from your first few roles?',
    optional: true,
    showIf: [{ questionId: 'age_band', equals: 'under_25' }],
    why: 'Kept on your profile only. Not scored, not sent to matching.',
    options: [
      { value: 'learn', label: 'Good training and room to learn' },
      { value: 'earn', label: 'Steady pay while I work things out' },
      { value: 'try_things', label: 'A chance to try different things' },
      { value: 'commit', label: 'One path I can commit to' },
    ],
  },
  // Age branch, 25 to 34.
  {
    id: 'age25_now',
    section: 'about_you',
    kind: 'single',
    prompt: 'What are you mostly doing right now?',
    optional: true,
    showIf: [{ questionId: 'age_band', equals: '25_34' }],
    why: 'Kept on your profile only. Not scored, not sent to matching.',
    options: [
      { value: 'in_field', label: 'Working in the field I want' },
      { value: 'want_out', label: 'Working, but ready for a change' },
      { value: 'retraining', label: 'Working while I retrain or study' },
      { value: 'between', label: 'Between jobs' },
    ],
  },
  {
    id: 'age25_evidence',
    section: 'about_you',
    kind: 'multi',
    prompt: 'What can you already point to?',
    help: 'Pick any.',
    optional: true,
    showIf: [{ questionId: 'age_band', equals: '25_34' }],
    why: 'Kept on your profile only. Not scored, not sent to matching.',
    options: [
      { value: 'led', label: 'Leading a project or people' },
      { value: 'promoted', label: 'Growth or a promotion in a role' },
      { value: 'specialism', label: 'A specialist skill or certification' },
      { value: 'switched', label: 'A change of field I have already made' },
      { value: 'nothing_stands_out', label: 'Nothing that stands out yet' },
    ],
  },
  {
    id: 'age25_next',
    section: 'about_you',
    kind: 'single',
    prompt: 'What do you want from the next few years?',
    optional: true,
    showIf: [{ questionId: 'age_band', equals: '25_34' }],
    why: 'Kept on your profile only. Not scored, not sent to matching.',
    options: [
      { value: 'step_up', label: 'More responsibility' },
      { value: 'deepen', label: 'Deeper expertise in what I do' },
      { value: 'change_field', label: 'A new field without starting over' },
      { value: 'balance', label: 'Better balance at the same standard of work' },
    ],
  },
  // The one "about you" answer that does something: it decides which mentorship
  // programs are listed. It is read on the device by the mentorship list and is
  // not part of the profile, so it never reaches the match request.
  {
    id: AUDIENCE_QUESTION_ID,
    section: 'about_you',
    kind: 'multi',
    prompt: 'Do any of these describe you?',
    help: 'Optional. Pick all that apply.',
    optional: true,
    why: 'Many mentorship programs are only open to certain groups. If you pick any, the mentorship list shows programs you can join. Stays on this device. Not scored, not sent to matching.',
    options: [
      { value: 'youth', label: 'In high school or under 18' },
      { value: 'students', label: 'A college or trade-school student' },
      { value: 'first_gen', label: 'First in my family to go to college' },
      { value: 'underrepresented_pros', label: 'An underrepresented early-career professional' },
      { value: 'women', label: 'A woman' },
      { value: 'veterans', label: 'A veteran' },
      { value: 'returning_citizens', label: 'Returning from incarceration' },
      { value: 'immigrants', label: 'An immigrant or new to the U.S.' },
    ],
  },
];

/**
 * Stated on the results screen and sent with every request, so the model is
 * told plainly what it does not have and does not try to infer it.
 * These are protected characteristics under US employment law (Title VII, ADA,
 * ADEA, GINA) and handling them here would make a high-risk system under the
 * EU AI Act. Salary history is separately restricted in many jurisdictions.
 *
 * "Not given" means never scored and never sent. The optional audience question
 * does ask about some of these, but only on the device, to filter mentorships.
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
