// Metro Detroit bulletin board content: which boards exist, the city list, and
// placeholder chatter so an empty board does not look broken. Content slice.
//
// Seed messages and posts are placeholders (isSample: true) from invented
// members and employers. Replace or delete them once real members are posting.

import type { Board, BoardMessage, BoardPost, BoardPostKind } from '../models';

export const BOARD_REGION = 'Metro Detroit';

export const BOARDS: Board[] = [
  // Age boards. `ageBand` matches the age_band answer in the questionnaire.
  {
    id: 'age-under-25',
    category: 'age',
    name: 'Under 25',
    blurb: 'First jobs, internships, apprenticeships and school-to-work leads.',
    ageBand: 'under_25',
  },
  {
    id: 'age-25-34',
    category: 'age',
    name: '25 to 34',
    blurb: 'Early-career moves, pivots and stepping up.',
    ageBand: '25_34',
  },
  {
    id: 'age-35-44',
    category: 'age',
    name: '35 to 44',
    blurb: 'Mid-career changes, management tracks and returning to work.',
    ageBand: '35_44',
  },
  {
    id: 'age-45-54',
    category: 'age',
    name: '45 to 54',
    blurb: 'Reinventing a career, reskilling and leadership roles.',
    ageBand: '45_54',
  },
  {
    id: 'age-55-plus',
    category: 'age',
    name: '55 and over',
    blurb: 'Encore careers, flexible roles and mentoring.',
    ageBand: '55_plus',
  },

  // Job boards. Sized to the industries Metro Detroit actually hires in.
  {
    id: 'job-automotive',
    category: 'job',
    name: 'Automotive and mobility',
    blurb: 'OEMs, suppliers, EV and autonomous vehicle work.',
  },
  {
    id: 'job-manufacturing',
    category: 'job',
    name: 'Manufacturing and skilled trades',
    blurb: 'Advanced manufacturing, welding, electrical, machining, logistics.',
  },
  {
    id: 'job-healthcare',
    category: 'job',
    name: 'Healthcare',
    blurb: 'Clinical, technical and support roles across the region.',
  },
  {
    id: 'job-tech',
    category: 'job',
    name: 'Tech and software',
    blurb: 'Software, data, IT and cybersecurity.',
  },
  {
    id: 'job-business',
    category: 'job',
    name: 'Finance and business',
    blurb: 'Banking, insurance, accounting, operations and sales.',
  },
  {
    id: 'job-education',
    category: 'job',
    name: 'Education and youth work',
    blurb: 'Teaching, tutoring, coaching and youth programs.',
  },
  {
    id: 'job-creative',
    category: 'job',
    name: 'Creative and media',
    blurb: 'Design, marketing, film, music and writing.',
  },
  {
    id: 'job-public',
    category: 'job',
    name: 'Public service and nonprofit',
    blurb: 'Government, community organizations and civic work.',
  },
  {
    id: 'job-research',
    category: 'job',
    name: 'Research and STEM',
    blurb: 'Labs, university research and research-adjacent programs.',
  },
];

export const BOARDS_BY_ID: ReadonlyMap<string, Board> = new Map(
  BOARDS.map((board) => [board.id, board]),
);

/** The board an `age_band` answer maps to, if any. Optional answers may be absent. */
export function ageBoardFor(ageBand: unknown): Board | null {
  if (typeof ageBand !== 'string') return null;
  return BOARDS.find((board) => board.ageBand === ageBand) ?? null;
}

/** Where a shared opportunity is. Metro Detroit cities plus remote. */
export const DETROIT_CITIES = [
  'Detroit',
  'Dearborn',
  'Southfield',
  'Troy',
  'Warren',
  'Sterling Heights',
  'Royal Oak',
  'Livonia',
  'Farmington Hills',
  'Auburn Hills',
  'Ann Arbor',
  'Other Metro Detroit',
  'Remote',
] as const;

export const POST_KINDS: { value: BoardPostKind; label: string }[] = [
  { value: 'job', label: 'Job' },
  { value: 'research', label: 'Research' },
  { value: 'program', label: 'Program' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
];

export const BOARD_COPY = {
  sectionTitle: 'Metro Detroit bulletin board',
  sectionBlurb:
    'Chat with people in your age group or field. Share leads.',
  emptyTitle: 'Join a board',
  emptyBody: 'Pick your age group and fields to see what people are sharing.',
  browse: 'Browse boards',
  directoryTitle: 'Boards',
  directoryBody:
    'Pick one age group and any fields you like.',
  ageHeading: 'Age group',
  ageHelp: 'Pick one.',
  jobHeading: 'Field',
  jobHelp: 'Pick any that fit.',
  suggested: 'Suggested for you',
  suggestedNote: 'Based on your age range. Stays on your device.',
  demoNote:
    'Demo: chat and posts stay on this device.',
  safetyNote:
    'Never share your address, phone, ID numbers or passwords. Check leads before acting.',
  shareTitle: 'Share an opportunity',
  shareBody: 'Found something that is not listed? Add it here.',
} as const;

const MINUTE_MS = 60 * 1000;

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE_MS).toISOString();
}

function sampleMessage(
  boardId: string,
  n: number,
  handle: string,
  body: string,
  minutes: number,
): BoardMessage {
  return {
    id: `sample-msg-${boardId}-${n}`,
    boardId,
    authorId: `sample-${handle}`,
    authorHandle: handle,
    body,
    postedAt: minutesAgo(minutes),
    isSample: true,
  };
}

function samplePost(
  boardId: string,
  n: number,
  handle: string,
  minutes: number,
  post: Pick<BoardPost, 'kind' | 'title' | 'organization' | 'city' | 'details'>,
): BoardPost {
  return {
    id: `sample-post-${boardId}-${n}`,
    boardId,
    authorId: `sample-${handle}`,
    authorHandle: handle,
    postedAt: minutesAgo(minutes),
    isSample: true,
    url: null,
    ...post,
  };
}

export const SAMPLE_MESSAGES: BoardMessage[] = [
  sampleMessage('age-under-25', 1, 'Sample member A', 'Anyone done a summer apprenticeship around Warren? Curious how the hours worked.', 190),
  sampleMessage('age-under-25', 2, 'Sample member B', 'Yes, mine was 30 hours a week and they paid for the certification.', 140),
  sampleMessage('age-25-34', 1, 'Sample member C', 'Switching from retail management into operations. Any advice on what to put on a resume?', 300),
  sampleMessage('job-automotive', 1, 'Sample member D', 'Are suppliers hiring for battery or software roles right now, or mostly still ICE?', 520),
  sampleMessage('job-healthcare', 1, 'Sample member E', 'Looking for entry-level roles where I can work toward a nursing degree.', 75),
  sampleMessage('job-tech', 1, 'Sample member F', 'Any Detroit meetups that welcome career changers?', 45),
];

export const SAMPLE_POSTS: BoardPost[] = [
  samplePost('age-under-25', 1, 'Sample member A', 240, {
    kind: 'program',
    title: 'Summer trades exploration (sample)',
    organization: 'Sample Detroit Youth Works',
    city: 'Detroit',
    details: 'Six weeks of paid hands-on shadowing across welding, electrical and HVAC. Placeholder listing.',
  }),
  samplePost('job-automotive', 1, 'Sample member D', 1500, {
    kind: 'job',
    title: 'Quality technician, second shift (sample)',
    organization: 'Sample Motor Components',
    city: 'Warren',
    details: 'Inspection and measurement on a small-parts line. Training provided. Placeholder listing.',
  }),
  samplePost('job-research', 1, 'Sample member G', 2000, {
    kind: 'research',
    title: 'Undergraduate lab assistant (sample)',
    organization: 'Sample University Lab',
    city: 'Ann Arbor',
    details: 'Ten hours a week supporting a materials research group. Placeholder listing.',
  }),
  samplePost('job-healthcare', 1, 'Sample member E', 900, {
    kind: 'event',
    title: 'Health careers open house (sample)',
    organization: 'Sample Health System',
    city: 'Southfield',
    details: 'Meet staff from nursing, imaging and lab teams. Placeholder listing.',
  }),
];
