// The curated registry: one line per program page that no API lists.
//
// Almost nobody in workforce development publishes a feed. Pretending otherwise
// produces a catalog that rots quietly. So the honest design is this file plus
// scripts/programs/ingest.ts, which every run:
//
//   1. fetches each url and checks it still answers 200,
//   2. re-reads the page and pulls cost, length, dates and eligibility off it,
//   3. hashes the page text and says which pages CHANGED since the last run.
//
// That means a scheduled re-run tells you "Detroit Training Center's welding page
// moved" or "Ada published a new deadline" instead of drifting into fiction.
//
// Adding a program is one entry. Keep `key` stable forever: it is half the id.
// Only put a number in `facts` when you have read it on the page yourself; the
// run report prints every hand-entered field so they can be re-checked.

import type {
  ApplicationMethod,
  CohortCadence,
  DeliveryFormat,
  FundingModel,
  ProgramAudience,
  ProgramSector,
} from './types';

export type RegistryEntry = {
  /** Stable slug. Half the opportunity id, so never rename it once shipped. */
  key: string;
  title: string;
  organization: string;
  /** The page a person lands on. Verified every run. */
  url: string;
  /** City for the region filter; null for statewide or online-only programmes. */
  city: string | null;
  /** Venue line for the card. */
  location: string | null;
  sector: ProgramSector;
  audiences: ProgramAudience[];
  /** Open beyond metro Detroit (state or national), so the region filter keeps it. */
  statewide?: boolean;
  /** Fallback one-liner, used only when the page yields no usable sentence. */
  summary: string;
  /** How fragile this entry is if the site changes. */
  fragility: 'low' | 'medium' | 'high';
  /** Facts confirmed by a human on the page. Everything else is read live. */
  facts?: {
    costUsd?: number | null;
    stipendUsd?: number | null;
    durationWeeks?: number | null;
    startsAt?: string | null;
    applyBy?: string | null;
    eligibility?: string[];
    funding?: FundingModel;
    delivery?: DeliveryFormat;
    credentials?: string[];
    applicationMethod?: ApplicationMethod;
    cadence?: CohortCadence;
  };
};

export const REGISTRY: RegistryEntry[] = [
  // ---- State-level programmes any Detroiter qualifies for --------------------
  {
    key: 'michigan-reconnect',
    title: 'Michigan Reconnect',
    organization: 'State of Michigan (LEO)',
    url: 'https://www.michigan.gov/reconnect',
    city: null,
    location: 'Any participating Michigan community college',
    sector: 'adult_education',
    audiences: ['older_workers'],
    statewide: true,
    summary:
      'A state scholarship that pays tuition for Michigan residents aged 25 and over to earn an associate degree or a skills certificate at their in-district community college.',
    fragility: 'low',
    facts: {
      costUsd: 0,
      durationWeeks: null,
      funding: 'free_to_participant',
      delivery: 'in_person',
      applicationMethod: 'online_form',
      cadence: 'rolling',
      eligibility: [
        'Be at least 25 years old',
        'Have lived in Michigan for at least a year',
        'Have a high school diploma or equivalent',
        'Have not already completed a college degree',
      ],
    },
  },
  {
    key: 'michigan-registered-apprenticeship',
    title: 'Michigan Registered Apprenticeships',
    organization: 'Michigan Department of Labor and Economic Opportunity',
    url: 'https://www.michigan.gov/leo/bureaus-agencies/wd/apprenticeships',
    city: null,
    location: 'Sponsors across Michigan',
    sector: 'skilled_trades',
    audiences: [],
    statewide: true,
    summary:
      "The state's directory of registered apprenticeships: paid, employer-sponsored training that combines on-the-job hours with classroom instruction and ends in a nationally recognised credential.",
    fragility: 'low',
    facts: { costUsd: 0, funding: 'paid_training', cadence: 'rolling', applicationMethod: 'online_form' },
  },
  {
    key: 'going-pro-talent-fund',
    title: 'Going PRO Talent Fund',
    organization: 'Michigan Department of Labor and Economic Opportunity',
    url: 'https://www.michigan.gov/leo/bureaus-agencies/wd/programs-services/going-pro-talent-fund',
    city: null,
    location: 'Through your employer, via a Michigan Works! agency',
    sector: 'general_workforce',
    audiences: [],
    statewide: true,
    summary:
      'State grants that pay for employees to be trained on the job. Employers apply through their local Michigan Works! agency, so ask your employer rather than applying yourself.',
    fragility: 'low',
    facts: { costUsd: 0, funding: 'employer_sponsored', applicationMethod: 'online_form', cadence: 'annual' },
  },
  {
    key: 'detroit-promise',
    title: 'Detroit Promise',
    organization: 'Detroit Regional Chamber',
    url: 'https://detroitpromise.com/about/',
    city: 'Detroit',
    location: 'Participating Michigan colleges and universities',
    sector: 'adult_education',
    audiences: ['detroit_residents', 'young_adults'],
    summary:
      'A last-dollar scholarship that gives eligible Detroit residents a tuition-free path to an associate degree, a bachelor’s degree or a technical certificate at participating institutions.',
    fragility: 'low',
    facts: { costUsd: 0, funding: 'free_to_participant', applicationMethod: 'online_form', cadence: 'annual' },
  },

  // ---- Tech, including the one the brief called "ADA" -------------------------
  {
    key: 'ada-developers-academy-core',
    title: 'Ada Core',
    organization: 'Ada Developers Academy',
    url: 'https://adadevelopersacademy.org/ada-core/',
    city: null,
    location: 'Online classroom; fellowship placements are usually in person',
    sector: 'tech',
    audiences: ['women', 'low_income'],
    statewide: true,
    summary:
      'A tuition-free software development programme for women and gender-expansive adults: six months of virtual classroom followed by the option to interview for a five-month paid fellowship at a partner company.',
    fragility: 'medium',
    facts: {
      costUsd: 0,
      durationWeeks: 26,
      funding: 'free_to_participant',
      delivery: 'online',
      cadence: 'cohort',
      applicationMethod: 'online_form',
      eligibility: [
        'Be 21 or older',
        'Live in the United States for the full duration of the programme',
        'Have permanent work authorisation (DACA recipients are eligible; OPT and CPT are not)',
        'Have foundational coding knowledge and access to a Mac',
      ],
    },
  },
  {
    key: 'apprenti-michigan',
    title: 'Apprenti tech apprenticeship',
    organization: 'Apprenti',
    url: 'https://apprenticareers.org/career-seeker/',
    city: null,
    location: 'Employer sites across Michigan',
    sector: 'tech',
    audiences: [],
    statewide: true,
    summary:
      'A registered apprenticeship into tech roles: unpaid-tuition classroom training followed by a paid apprenticeship with a partner employer, aimed at people with no tech background.',
    fragility: 'medium',
    facts: { funding: 'paid_training', applicationMethod: 'online_form', cadence: 'cohort' },
  },

  // ---- Skilled trades and construction ---------------------------------------
  {
    key: 'dtc-michigan-builders-license',
    title: 'Michigan Builders License Preparation',
    organization: 'Detroit Training Center',
    url: 'https://detroittraining.com/mibuilders',
    city: 'Detroit',
    location: 'Detroit Training Center, Detroit',
    sector: 'skilled_trades',
    audiences: [],
    summary:
      'The 60-hour pre-licensure course Michigan requires before you can sit the residential builders licence exam, run live and in the classroom.',
    fragility: 'medium',
    // The page prints "Michigan Residential Builders License Class $750 Total";
    // it is 60 taught hours, and it never says how many weeks that is spread over.
    facts: { costUsd: 750, durationWeeks: null, credentials: ['Michigan Builders License'] },
  },
  {
    key: 'dtc-welding',
    title: 'Welding Training',
    organization: 'Detroit Training Center',
    url: 'https://detroittraining.com/welding',
    city: 'Detroit',
    location: 'Detroit Training Center, Detroit',
    sector: 'skilled_trades',
    audiences: [],
    summary: 'Hands-on welding training at the Detroit Training Center shop, covering the processes employers hire for.',
    fragility: 'medium',
  },
  {
    key: 'dtc-heavy-equipment',
    title: 'Heavy Equipment Operator Training',
    organization: 'Detroit Training Center',
    url: 'https://detroittraining.com/heavy-equipment',
    city: 'Detroit',
    location: 'Detroit Training Center, Detroit',
    sector: 'skilled_trades',
    audiences: [],
    summary: 'Operator training on excavators, backhoes, skid steers and other heavy equipment, with seat time on real machines.',
    fragility: 'medium',
  },

  // ---- Community colleges and adult education ---------------------------------
  {
    key: 'wcccd-workforce-development',
    title: 'Center for Workforce and Economic Development',
    organization: 'Wayne County Community College District',
    url: 'https://www.wcccd.edu/center-for-workforce-and-economic-development',
    city: 'Detroit',
    location: 'WCCCD campuses across Wayne County',
    sector: 'general_workforce',
    audiences: [],
    summary:
      "WCCCD's workforce arm: short-cycle training and industry certifications built with local employers, sitting alongside the college's credit programmes.",
    fragility: 'medium',
  },
  {
    key: 'wcccd-continuing-education',
    title: 'Continuing Education courses',
    organization: 'Wayne County Community College District',
    url: 'https://www.wcccd.edu/continuing-education',
    city: 'Detroit',
    location: 'WCCCD campuses across Wayne County',
    sector: 'adult_education',
    audiences: [],
    summary: 'Non-credit courses and certificate tracks for adults returning to study, including healthcare and trade certifications.',
    fragility: 'medium',
  },

  // ---- Youth and young adults --------------------------------------------------
  {
    key: 'gdyt-summer',
    title: "Grow Detroit's Young Talent",
    organization: "Grow Detroit's Young Talent",
    url: 'https://gdyt.org/youth',
    city: 'Detroit',
    location: 'Employer placements across Detroit',
    sector: 'general_workforce',
    audiences: ['youth', 'young_adults', 'detroit_residents'],
    summary:
      "Detroit's citywide summer jobs programme: six weeks of paid work experience with a local employer for residents aged 14 to 24, with far more applicants than places.",
    fragility: 'medium',
    facts: { costUsd: 0, funding: 'paid_training', cadence: 'annual', applicationMethod: 'online_form' },
  },
  {
    key: 'swsol-youth',
    title: 'Youth Programs',
    organization: 'Southwest Solutions',
    url: 'https://swsol.org/economics/youth-programs',
    city: 'Detroit',
    location: 'Southwest Detroit',
    sector: 'general_workforce',
    audiences: ['youth', 'young_adults', 'spanish_speakers'],
    summary: 'Work readiness, education and employment support for young people in southwest Detroit.',
    fragility: 'medium',
  },

  // ---- Adult education, literacy and bridges -----------------------------------
  {
    key: 'swsol-adult-literacy',
    title: 'Adult Literacy',
    organization: 'Southwest Solutions',
    url: 'https://swsol.org/economics/adult-literacy',
    city: 'Detroit',
    location: 'Southwest Detroit',
    sector: 'adult_education',
    audiences: ['spanish_speakers', 'immigrants'],
    summary: 'Adult basic education, high school completion and English language classes in southwest Detroit.',
    fragility: 'medium',
  },
  {
    key: 'swsol-earn-learn',
    title: 'Earn + Learn',
    organization: 'Southwest Solutions',
    url: 'https://swsol.org/economics/earn-learn',
    city: 'Detroit',
    location: 'Southwest Detroit',
    sector: 'general_workforce',
    audiences: ['low_income', 'spanish_speakers'],
    summary: 'A programme that pairs paid work experience with classroom learning for adults in southwest Detroit.',
    fragility: 'medium',
  },
  {
    key: 'swsol-career-center',
    title: 'Career Center',
    organization: 'Southwest Solutions',
    url: 'https://swsol.org/economics/career-center',
    city: 'Detroit',
    location: 'Southwest Detroit',
    sector: 'general_workforce',
    audiences: ['spanish_speakers', 'immigrants', 'low_income'],
    summary: 'Job readiness coaching, placement help and training referrals for adults in southwest Detroit, offered in English and Spanish.',
    fragility: 'medium',
  },
  {
    key: 'swsol-hvrp',
    title: "Homeless Veterans' Reintegration Program",
    organization: 'Southwest Solutions',
    url: 'https://swsol.org/economics/homeless-veterans-reintegration-program-hvrp',
    city: 'Detroit',
    location: 'Southwest Detroit',
    sector: 'general_workforce',
    audiences: ['veterans', 'low_income'],
    summary: 'Employment services, training and housing support for veterans in Detroit who are homeless or at risk of it.',
    fragility: 'medium',
  },

  // ---- Immigrant and Arab American communities ---------------------------------
  {
    key: 'access-career-path',
    title: 'Career Path / Self-Sufficiency Project',
    organization: 'ACCESS',
    url: 'https://www.accesscommunity.org/employment-services/access-career-path-self-sufficiency-project',
    city: 'Dearborn',
    location: 'ACCESS, Dearborn',
    sector: 'general_workforce',
    audiences: ['immigrants', 'low_income'],
    summary:
      'Case-managed employment and training support for people moving off public assistance, delivered in Arabic and English at ACCESS in Dearborn.',
    fragility: 'medium',
  },
  {
    key: 'access-job-seeker',
    title: 'Job Seeker Services',
    organization: 'ACCESS',
    url: 'https://www.accesscommunity.org/employment-services/job-seeker-resources',
    city: 'Dearborn',
    location: 'ACCESS, Dearborn',
    sector: 'general_workforce',
    audiences: ['immigrants'],
    summary: 'Training referrals, job placement and workplace English support for immigrant and Arab American job seekers in metro Detroit.',
    fragility: 'medium',
  },

  // ---- Entrepreneurship and small business -------------------------------------
  {
    key: 'motor-city-match',
    title: 'Motor City Match',
    organization: 'City of Detroit / Detroit Economic Growth Corporation',
    url: 'https://www.motorcitymatch.com/',
    city: 'Detroit',
    location: 'Detroit',
    sector: 'entrepreneurship',
    audiences: ['detroit_residents'],
    summary:
      'A competitive round-based programme that matches Detroit businesses with buildings, design and business-plan help, and cash grants toward a bricks-and-mortar space.',
    fragility: 'medium',
    facts: { cadence: 'cohort', applicationMethod: 'online_form' },
  },
  {
    key: 'lisc-detroit',
    title: 'LISC Detroit small business and workforce programmes',
    organization: 'LISC Detroit',
    url: 'https://www.lisc.org/detroit/',
    city: 'Detroit',
    location: 'Detroit',
    sector: 'entrepreneurship',
    audiences: ['detroit_residents'],
    summary: 'LISC Detroit runs funding rounds, business coaching and construction workforce initiatives for Detroit neighbourhoods.',
    fragility: 'high',
  },
  {
    key: 'michigan-central-community',
    title: 'Michigan Central community programmes',
    organization: 'Michigan Central',
    url: 'https://michigancentral.com/community/',
    city: 'Detroit',
    location: 'Michigan Central, Corktown, Detroit',
    sector: 'tech',
    audiences: ['detroit_residents', 'young_adults'],
    summary:
      'Michigan Central runs mobility and technology programming out of Corktown, including community training, fellowships and studio residencies.',
    fragility: 'high',
  },
];
