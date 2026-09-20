// Detroit-area front doors: apprenticeships and internships a person can
// actually walk up to, with the sponsor's own page as the link.
//
// This file is typed in by hand, and it is the only place in scripts/jobs where
// that is true. It has to be: apprenticeship.gov publishes its Michigan sponsor
// list through a Tableau embed, and its job finder runs on the CareerOneStop
// API, which needs a key. Neither is readable keyless. See docs/job-sources.md.
//
// Rules for anything added here:
//   - the url is the sponsor's own page, not an aggregator or a job board;
//   - the entry is evergreen — a standing programme, not one posting that
//     expires. Nothing here carries an application deadline, because the intake
//     windows move every year and a stale date is worse than none;
//   - socCodes name the occupations the route leads into. The first one supplies
//     the match tags from O*NET and the wage band from BLS. Leave it empty for a
//     cross-sector programme, and the item is tagged neutrally instead of
//     pretending to know;
//   - verifiedOn is the day a person last read the page. The ingest re-checks
//     that every url still answers, but only a human can check it still says
//     what we claim.

import type { EntryRouteSeed } from './types';

/** The day this list was last read end to end by a person. */
const CHECKED = '2026-09-19';

export const ENTRY_ROUTE_SEEDS: EntryRouteSeed[] = [
  {
    slug: 'ibew58-eitc-electrician',
    title: 'Electrician apprenticeship — IBEW Local 58',
    organization: 'Detroit Electrical Industry Training Center',
    summary:
      'Five-year registered apprenticeship for inside electricians, run jointly by IBEW Local 58 and the electrical contractors. You earn a wage from the first day and pay no tuition; the application window opens for a few days each year.',
    url: 'https://detroiteitc.org/apply/',
    city: 'Detroit',
    employmentType: 'Apprenticeship',
    sector: 'Construction',
    socCodes: ['47-2111'],
    entryRoutes: [
      'Apply during the annual window on the training centre site',
      'High school diploma or GED, plus one year of algebra',
      'Aptitude test and interview set your place on the list',
    ],
    hiringHere: ['Electrical contractors across metro Detroit', 'IBEW Local 58 signatory shops'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'ua98-plumber',
    title: 'Plumber apprenticeship — UA Local 98',
    organization: 'Plumbers Local 98 Training Center',
    summary:
      'Registered five-year plumbing apprenticeship covering residential, commercial and service work. Classroom nights at the Local 98 training centre, paid work on job sites during the day.',
    url: 'https://www.plumbers98tc.org/apprenticeship',
    city: 'Detroit',
    employmentType: 'Apprenticeship',
    sector: 'Construction',
    socCodes: ['47-2152'],
    entryRoutes: ['Apply through the Local 98 training centre', 'No tuition; you are paid while you train'],
    hiringHere: ['Mechanical and plumbing contractors across the metro'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'ua636-pipefitter',
    title: 'Pipefitter and HVAC service apprenticeship — UA Local 636',
    organization: 'Pipefitters Local 636',
    summary:
      'Apprenticeship in pipefitting, welding and HVAC service for the plants, hospitals and high-rises around Detroit. Training is at the Local 636 centre and the work is paid from day one.',
    url: 'https://pipefitters636.org/training/',
    city: 'Detroit',
    employmentType: 'Apprenticeship',
    sector: 'Construction',
    socCodes: ['47-2152'],
    entryRoutes: ['Apply through the Local 636 training department', 'Welding and HVAC tracks run alongside the pipefitting one'],
    hiringHere: ['Mechanical contractors serving the plants, hospitals and commercial buildings'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'mrcc-carpenter-millwright',
    title: 'Carpenter and millwright apprenticeship — Michigan Carpenters',
    organization: 'Michigan Regional Council of Carpenters and Millwrights',
    summary:
      'Four-year apprenticeships in carpentry, floor laying and millwright work, taught at the council training centre on Detroit’s west side. Tuition-free, with wages and benefits that step up as you pass each level.',
    url: 'https://www.buildmifuture.com/apprenticeship-2/',
    city: 'Detroit',
    employmentType: 'Apprenticeship',
    sector: 'Construction',
    socCodes: ['47-2031', '49-9044'],
    entryRoutes: ['Apply through the council; intakes run through the year', 'No tuition and no student debt'],
    hiringHere: ['Union general contractors and interior firms', 'Plant millwright crews at the automakers and suppliers'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'ironworkers25-structural',
    title: 'Ironworker apprenticeship — Iron Workers Local 25',
    organization: 'Iron Workers Local 25',
    summary:
      'Registered apprenticeship in structural steel, rebar, rigging and welding across Michigan. Physical outdoor work at height, learned on the job with paid classroom weeks.',
    url: 'https://www.ironworkers25.org/apprenticeship',
    city: null,
    employmentType: 'Apprenticeship',
    sector: 'Construction',
    socCodes: ['47-2221'],
    entryRoutes: ['Apply through the Local 25 apprenticeship office', 'Expect a physical assessment and a drug screen'],
    hiringHere: ['Steel erectors and general contractors on metro Detroit projects'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'bac-michigan-masonry',
    title: 'Masonry and tile apprenticeship — BAC Michigan',
    organization: 'Bricklayers and Allied Craftworkers, Michigan',
    summary:
      'Apprenticeships in bricklaying, tile setting, cement masonry and restoration, taught at the union training centres. Paid work from the start, with classroom time built in.',
    url: 'https://bricklayers.org/training',
    city: null,
    employmentType: 'Apprenticeship',
    sector: 'Construction',
    socCodes: ['47-2021'],
    entryRoutes: ['Apply through the BAC Michigan training department', 'Separate tracks for brick, tile, marble and cement work'],
    hiringHere: ['Masonry and restoration contractors across the metro'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'smart80-sheet-metal',
    title: 'Sheet metal apprenticeship — SMART Local 80',
    organization: 'Sheet Metal Workers Local 80 Training Center',
    summary:
      'Apprenticeship in sheet metal fabrication, HVAC installation and service balancing, taught at the Local 80 centre in Warren. No up-front cost for schooling or materials.',
    url: 'https://smw80jac.org/',
    city: 'Warren',
    employmentType: 'Apprenticeship',
    sector: 'Construction',
    socCodes: ['47-2211'],
    entryRoutes: ['Call the Local 80 training centre for an application appointment', 'No up-front cost for schooling or materials'],
    hiringHere: ['HVAC and sheet metal contractors across metro Detroit'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'iuoe324-operating-engineer',
    title: 'Heavy equipment operator apprenticeship — Operating Engineers 324',
    organization: 'Operating Engineers Local 324',
    summary:
      'Apprenticeship for running excavators, cranes, dozers and graders on road, utility and site work across Michigan, with training at the union’s own equipment school.',
    url: 'http://www.iuoe324.org/',
    city: null,
    employmentType: 'Apprenticeship',
    sector: 'Construction',
    socCodes: ['47-2073'],
    entryRoutes: ['Apply through Local 324', 'Seasonal work: winters are slower than summers'],
    hiringHere: ['Road, utility and site contractors', 'MDOT and county road commission projects'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'dte-line-worker',
    title: 'Line worker and energy technician training — DTE Energy',
    organization: 'DTE Energy',
    summary:
      'DTE hires and trains line workers, gas technicians and plant operators for the grid across southeast Michigan. Entry-level and apprentice-level roles are posted on its careers site through the year.',
    url: 'https://www.dteenergy.com/us/en/residential/about-dte/careers.html',
    city: 'Detroit',
    employmentType: 'Apprenticeship',
    sector: 'Skilled trades',
    socCodes: ['49-9051'],
    entryRoutes: [
      'Watch the DTE careers site for apprentice and trainee postings',
      'Pre-employment testing and a physical are part of the process',
      'Some candidates come through a community college line-worker programme first',
    ],
    hiringHere: ['DTE Energy', 'Utility contractors working on the same grid'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'focus-hope-machinist',
    title: 'Machinist and IT training — Focus: HOPE',
    organization: 'Focus: HOPE',
    summary:
      'Detroit’s longest-running free career training centre, on Oakman Boulevard. Machining, IT and information technology tracks run in short cohorts and lead straight into employer placement.',
    url: 'https://www.focushope.edu/programs/job-training/',
    city: 'Detroit',
    employmentType: 'Apprenticeship',
    sector: 'Manufacturing and automotive',
    socCodes: ['51-4041'],
    entryRoutes: [
      'Apply directly to Focus: HOPE; cohorts start through the year',
      'Open to adults with a diploma or GED',
      'Placement support with partner employers at the end',
    ],
    hiringHere: ['Machine and tool shops across the metro', 'Tier-1 and tier-2 auto suppliers'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'gdyt-youth-jobs',
    title: 'Summer jobs for Detroit young people — GDYT',
    organization: "Grow Detroit's Young Talent",
    summary:
      'The city’s summer employment programme places thousands of Detroiters aged 14 to 24 in paid jobs across every sector, from hospitals to offices to construction. Applications open in late winter each year.',
    url: 'https://gdyt.org/',
    city: 'Detroit',
    employmentType: 'Internship',
    sector: 'Social and community services',
    socCodes: [],
    entryRoutes: ['Apply online in late winter for the summer placement', 'Detroit residents aged 14-24', 'No experience needed'],
    hiringHere: ['Employers across every sector in the city'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'henry-ford-health-clinical-entry',
    title: 'Clinical entry roles and apprenticeships — Henry Ford Health',
    organization: 'Henry Ford Health',
    summary:
      'The metro’s largest health system trains into a lot of its own clinical support roles: medical assistants, sterile processing, patient care techs. Trainee and apprentice postings appear on its careers site through the year.',
    url: 'https://careers.henryford.com/',
    city: 'Detroit',
    employmentType: 'Apprenticeship',
    sector: 'Healthcare support',
    socCodes: ['31-9092'],
    entryRoutes: [
      'Search the careers site for apprentice, trainee and "no experience" postings',
      'Many roles take a diploma or GED plus a short certificate',
      'Tuition support for staff moving into nursing and tech roles',
    ],
    hiringHere: ['Henry Ford Health hospitals and clinics across the metro'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'corewell-health-east-entry',
    title: 'Nursing assistant and support entry roles — Corewell Health East',
    organization: 'Corewell Health East',
    summary:
      'The former Beaumont hospitals hire nursing assistants, patient care techs and support staff across Oakland, Macomb and Wayne, and train many of them in-house before they step up.',
    url: 'https://careers.corewellhealth.org/us/en',
    city: 'Royal Oak',
    employmentType: 'Apprenticeship',
    sector: 'Healthcare support',
    socCodes: ['31-1131'],
    entryRoutes: [
      'Apply through the Corewell careers site',
      'Nursing assistant roles usually take a short state-approved course',
      'Tuition help for staff going on to nursing',
    ],
    hiringHere: ['Corewell Health East hospitals in Royal Oak, Troy, Dearborn, Farmington Hills and Grosse Pointe'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'ford-internships',
    title: 'Internships and co-ops — Ford Motor Company',
    organization: 'Ford Motor Company',
    summary:
      'Ford runs one of the largest internship and co-op programmes in the region, in engineering, manufacturing, IT and business, based in Dearborn and at Michigan Central.',
    url: 'https://www.careers.ford.com/',
    city: 'Dearborn',
    employmentType: 'Internship',
    sector: 'Engineering and design',
    socCodes: ['17-2112'],
    entryRoutes: [
      'Apply in the autumn for the following summer',
      'Co-op terms alternate with semesters for students at Michigan schools',
      'Interns are a main source of graduate hires',
    ],
    hiringHere: ['Ford Motor Company', 'Its suppliers, who run comparable programmes'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'smart-bus-operator',
    title: 'Bus operator training — SMART',
    organization: 'Suburban Mobility Authority for Regional Transportation',
    summary:
      'SMART trains new bus operators from scratch and pays them through the commercial licence process. A route into a public-sector job with a pension and no degree requirement.',
    url: 'https://www.smartbus.org/About/Careers',
    city: 'Detroit',
    employmentType: 'Apprenticeship',
    sector: 'Transportation and logistics',
    socCodes: ['53-3052'],
    entryRoutes: [
      'Apply through the SMART careers portal',
      'Paid CDL training for candidates without a licence',
      'Clean driving record and a diploma or GED',
    ],
    hiringHere: ['SMART', 'DDOT, which hires operators on similar terms'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'teach-detroit-pipeline',
    title: 'Teacher pipeline — Detroit Public Schools Community District',
    organization: 'Teach Detroit (DPSCD)',
    summary:
      'DPSCD’s recruitment front door, including its routes for paraprofessionals and career-changers to become certified teachers while working in a classroom.',
    url: 'https://www.teachdetroit.org/',
    city: 'Detroit',
    employmentType: 'Apprenticeship',
    sector: 'Education',
    socCodes: ['25-2021'],
    entryRoutes: [
      'Apply through Teach Detroit',
      'Paraprofessional and substitute roles are the common way in',
      'Certification support while you work',
    ],
    hiringHere: ['Detroit Public Schools Community District', 'Charter networks across the city'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'michigan-central-programs',
    title: 'Mobility and tech programmes — Michigan Central',
    organization: 'Michigan Central',
    summary:
      'The Corktown innovation district runs fellowships, internships and training programmes with the startups and teams working out of the station and Newlab.',
    url: 'https://michigancentral.com/',
    city: 'Detroit',
    employmentType: 'Internship',
    sector: 'Technology',
    socCodes: ['15-1252'],
    entryRoutes: [
      'Watch the programmes page; cohorts and fellowships open through the year',
      'Several tracks are aimed at Detroit residents with no tech background',
    ],
    hiringHere: ['Startups and mobility teams based at Michigan Central', 'Ford and its technology partners'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
  {
    slug: 'newlab-detroit',
    title: 'Startup internships — Newlab at Michigan Central',
    organization: 'Newlab',
    summary:
      'Newlab houses dozens of hardware and mobility startups in Corktown, most of which take interns and early-career engineers directly rather than through a central programme.',
    url: 'https://www.newlab.com/',
    city: 'Detroit',
    employmentType: 'Internship',
    sector: 'Engineering and design',
    socCodes: ['17-2199'],
    entryRoutes: ['Approach member companies directly through the Newlab directory', 'Events at the building are the usual first contact'],
    hiringHere: ['Newlab member startups', 'Their corporate partners in mobility and energy'],
    payMinUsd: null,
    payMaxUsd: null,
    verifiedOn: CHECKED,
  },
];
