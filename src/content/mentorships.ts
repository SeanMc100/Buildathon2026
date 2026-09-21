// Mentorship programs run by other organisations. Content slice.
//
// The app does not run these or take applications. Each entry says who the
// provider lets in and links to the provider's own page. Hand-curated: every
// entry was read off the provider's site, and `verifiedOn` is the day it was
// last checked. Re-check before demo day; programs change their intake windows.
//
// `audiences` follows the provider's wording. Empty means open to anyone. A
// visitor who answered the "which describe you" question sees only the
// entries that include one of their answers, or that are open to anyone
// (see src/catalog/audience.ts).

import type { MentorshipOpportunity, PreferenceTrait } from '../models';

const VERIFIED = '2026-09-20';

// Mentorships are listed, not ranked, so these tags are neutral. They exist
// because every opportunity carries the same set.
const NEUTRAL_TRAITS: Record<PreferenceTrait, number> = {
  pay_and_security: 50,
  flexibility_and_balance: 50,
  growth_and_learning: 80,
  mission_and_impact: 60,
  people_and_team: 80,
  manager_support: 70,
  autonomy: 50,
};

const base: Pick<
  MentorshipOpportunity,
  'kind' | 'hollandCode' | 'traits' | 'jobZone' | 'minEducation' | 'suitableStages' | 'demands' | 'verifiedOn' | 'isSample'
> = {
  kind: 'mentorship',
  hollandCode: [],
  traits: NEUTRAL_TRAITS,
  jobZone: null,
  minEducation: 'none_required',
  suitableStages: [],
  demands: [],
  verifiedOn: VERIFIED,
  isSample: false,
};

export const MENTORSHIPS: MentorshipOpportunity[] = [
  {
    ...base,
    id: 'mentorship-ilitch-xinspire',
    title: 'Ilitch School Mentorship Program',
    organization: 'Wayne State University, Mike Ilitch School of Business',
    summary:
      'One-on-one mentoring with alumni and industry professionals, matched through the Xinspire platform. Built for first-generation business students.',
    url: 'https://ilitchbusiness.xinspire.com/',
    location: 'Detroit, MI',
    minEducation: 'secondary',
    audiences: ['students', 'first_gen'],
    eligibility: [
      'Undergraduate student at the Ilitch School of Business',
      'At least one full academic year left',
    ],
    format: 'One-on-one with an industry mentor',
    schedule: 'Applications open each fall',
    costUsd: 0,
  },
  {
    ...base,
    id: 'mentorship-ace-semi',
    title: 'ACE Mentor Program of Southeast Michigan',
    organization: 'ACE Mentor Southeast Michigan',
    summary:
      'Free after-school program where high schoolers team up with architects, engineers and builders to work through a real project.',
    url: 'https://www.acementorsemi.org/',
    location: 'Detroit, MI',
    audiences: ['youth'],
    eligibility: ['High school student in metro Detroit'],
    format: 'Small teams with volunteer industry mentors',
    schedule: 'January to May, weekly',
    costUsd: 0,
  },
  {
    ...base,
    id: 'mentorship-winning-futures',
    title: 'Workforce Prep Mentoring',
    organization: 'Winning Futures',
    summary:
      'Students meet with volunteer career mentors over several years, with planning support and scholarships along the way.',
    url: 'https://winningfutures.org/',
    location: null,
    audiences: ['youth'],
    eligibility: ['Middle and high school students'],
    format: 'Regular one-hour sessions with a career mentor',
    schedule: 'Multi-year',
    costUsd: null,
  },
  {
    ...base,
    id: 'mentorship-imagine',
    title: 'I.M.A.G.I.N.E. Mentoring',
    organization: 'I.M.A.G.I.N.E. Mentoring',
    summary:
      'Mentoring and life coaching for girls and women in Detroit, including personal and professional development for adults 18 and over.',
    url: 'https://imaginementoring.com/',
    location: 'Detroit, MI',
    audiences: ['women'],
    eligibility: ['Girls and women, including adults 18 and over'],
    format: 'Mentoring and life coaching',
    schedule: null,
    costUsd: null,
  },
];
