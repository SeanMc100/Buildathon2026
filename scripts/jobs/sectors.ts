// Sectors, and the one piece of this pipeline that is hand-written.
//
// Everything else in scripts/jobs is measured: O*NET rates the work, BLS prices
// it, Projections Central projects it. None of them answer "who around here
// actually hires for this", which is the question a person in Detroit asks
// first. So `hiringHere` below is editorial — written by hand, kept general
// enough to stay true, and flagged in every item as provenance
// 'curated-by-sector'. It is the first thing a human should check.
//
// The sector itself comes from the SOC major group, with a handful of overrides
// where the federal grouping puts a job somewhere a person would not look for
// it (a construction manager is in "Management", but they work in construction).

/** SOC major group (first two digits) -> the sector a person would name. */
const MAJOR_GROUP_SECTORS: Record<string, string> = {
  '11': 'Management',
  '13': 'Finance and business',
  '15': 'Technology',
  '17': 'Engineering and design',
  '19': 'Science and research',
  '21': 'Social and community services',
  '23': 'Legal',
  '25': 'Education',
  '27': 'Creative and media',
  '29': 'Healthcare',
  '31': 'Healthcare support',
  '33': 'Public safety',
  '35': 'Hospitality and food',
  '37': 'Facilities and grounds',
  '39': 'Personal care and service',
  '41': 'Sales and retail',
  '43': 'Office and administration',
  '45': 'Farming and grounds production',
  '47': 'Construction',
  '49': 'Skilled trades',
  '51': 'Manufacturing and automotive',
  '53': 'Transportation and logistics',
};

/** Jobs whose SOC group hides where the work really happens. */
const SOC_SECTOR_OVERRIDES: Record<string, string> = {
  '11-9021': 'Construction', // Construction Managers
  '11-3051': 'Manufacturing and automotive', // Industrial Production Managers
  '11-9111': 'Healthcare', // Medical and Health Services Managers
  '11-9031': 'Education', // Education and Childcare Administrators, Preschool
  '11-9032': 'Education', // Education Administrators, K-12
  '11-9033': 'Education', // Education Administrators, Postsecondary
  '11-9151': 'Social and community services', // Social and Community Service Managers
  '11-3071': 'Transportation and logistics', // Transportation, Storage, Distribution Managers
  '11-2021': 'Creative and media', // Marketing Managers
  '11-2022': 'Sales and retail', // Sales Managers
  '11-3021': 'Technology', // Computer and Information Systems Managers
  '11-9051': 'Hospitality and food', // Food Service Managers
  '11-9141': 'Facilities and grounds', // Property and Real Estate Managers
  '11-1021': 'Management',
  '13-1071': 'Office and administration', // Human Resources Specialists
  '13-1151': 'Education', // Training and Development Specialists
  '13-1081': 'Transportation and logistics', // Logisticians
  '29-9021': 'Healthcare support', // Health Information Technologists
  '43-6013': 'Healthcare support', // Medical Secretaries and Administrative Assistants
  '43-4051': 'Office and administration', // Customer Service Representatives
  '43-5032': 'Public safety', // Public Safety Telecommunicators
  '43-5011': 'Transportation and logistics', // Cargo and Freight Agents
  '43-5071': 'Transportation and logistics', // Shipping, Receiving, and Inventory Clerks
  '49-9041': 'Manufacturing and automotive', // Industrial Machinery Mechanics
  '49-9071': 'Facilities and grounds', // Maintenance and Repair Workers, General
  '51-4041': 'Manufacturing and automotive', // Machinists
  '53-3032': 'Transportation and logistics',
  '27-1024': 'Creative and media',
  '25-2059': 'Education',
  '31-1131': 'Healthcare support', // Nursing Assistants
  '21-1093': 'Social and community services', // Social and Human Service Assistants
};

/**
 * Who hires for this work in metro Detroit. Hand-written per sector; deliberately
 * named at the level of "these kinds of employers, and here the big ones are
 * these", because no source in this pipeline publishes employer-by-occupation
 * data. Review before launch.
 */
const SECTOR_EMPLOYERS: Record<string, string[]> = {
  Management: ['Large employers across the metro', 'Hospital systems and school districts', 'Auto suppliers and logistics firms'],
  'Finance and business': [
    'Rocket Companies and Ally Financial downtown',
    'Comerica, Flagstar and local credit unions',
    'Accounting and consulting firms in Southfield and Troy',
  ],
  Technology: [
    'Rocket Companies, Ally and OneStream',
    'IT teams inside the automakers and their suppliers',
    'Health systems and the City of Detroit',
    'Startups around TechTown, Newlab and Michigan Central',
  ],
  'Engineering and design': [
    'Stellantis, Ford and GM engineering centers',
    'Tier-1 suppliers: Magna, BorgWarner, Lear, Aptiv, Dana',
    'Engineering services firms in Auburn Hills, Dearborn and Troy',
  ],
  'Science and research': [
    'Wayne State University and Michigan Medicine',
    'Henry Ford Health research institutes',
    'Environmental and testing labs serving the auto industry',
  ],
  'Social and community services': [
    'Neighborhood Service Organization, Wayne Metro, Matrix Human Services',
    'Detroit Wayne Integrated Health Network and its provider network',
    'Goodwill Detroit, Focus: HOPE and other workforce nonprofits',
  ],
  Legal: ['Law firms downtown and in Troy/Bloomfield', 'Wayne County courts', 'In-house legal teams at the automakers'],
  Education: [
    'Detroit Public Schools Community District',
    'Suburban districts across Wayne, Oakland and Macomb',
    'Wayne State, Wayne County Community College District, Oakland University, Henry Ford College',
    'Charter networks and Head Start providers',
  ],
  'Creative and media': [
    'Agencies in Detroit, Birmingham and Royal Oak',
    'In-house brand and content teams at the automakers and Rocket',
    'Local media, production houses and freelance work',
  ],
  Healthcare: [
    'Henry Ford Health',
    'Corewell Health East (the former Beaumont hospitals)',
    'Detroit Medical Center and Ascension Michigan',
    'University of Michigan Health and Trinity Health in the western suburbs',
  ],
  'Healthcare support': [
    'Hospital systems across the metro',
    'Outpatient clinics, dental and physician practices',
    'Nursing homes, home care agencies and dialysis centers',
  ],
  'Public safety': [
    'Detroit Police and Fire and suburban departments',
    'Wayne, Oakland and Macomb county sheriffs',
    'Hospital, campus and private security across the metro',
  ],
  'Hospitality and food': [
    'Restaurants and bars across Detroit, Ferndale, Royal Oak and Dearborn',
    'MGM Grand, MotorCity and Hollywood Casino Greektown',
    'Stadium, airport and hospital food service contractors',
  ],
  'Facilities and grounds': [
    'Building service contractors downtown and in the office corridors',
    'Hospitals, universities and school districts',
    'Property managers and landscaping firms across the suburbs',
  ],
  'Personal care and service': [
    'Salons, barbershops and spas across the metro',
    'Child care centers and home care agencies',
    'Fitness and recreation operators',
  ],
  'Sales and retail': [
    'Retail across the metro, including Somerset, Twelve Oaks and Great Lakes Crossing',
    'Auto dealerships throughout Wayne, Oakland and Macomb',
    'Wholesale and industrial distributors serving the plants',
  ],
  'Office and administration': [
    'Hospital systems, school districts and county government',
    'Rocket Companies, Ally and the insurance carriers',
    'Auto suppliers and logistics firms across the suburbs',
  ],
  'Farming and grounds production': ['Nurseries and greenhouses in the outer suburbs', 'Urban farms and food-growing nonprofits in Detroit'],
  Construction: [
    'Barton Malow, Walbridge, Christman and other general contractors',
    'Electrical, mechanical and concrete subcontractors across the metro',
    'MDOT and city road and utility work',
  ],
  'Skilled trades': [
    'Plant maintenance teams at the automakers and their suppliers',
    'Mechanical and electrical contractors across the metro',
    'Fleet shops, dealerships and building owners',
  ],
  'Manufacturing and automotive': [
    'Stellantis, Ford and GM assembly and powertrain plants',
    'Tier-1 and tier-2 suppliers across Wayne, Oakland and Macomb',
    'Independent machine, tool-and-die and fabrication shops',
  ],
  'Transportation and logistics': [
    'Warehouses and distribution centers along I-94, I-75 and near DTW',
    'Trucking and freight brokerage firms',
    'Detroit Metro Airport, DDOT and SMART',
  ],
};

export function sectorFor(socCode: string): string {
  const override = SOC_SECTOR_OVERRIDES[socCode];
  if (override) return override;
  return MAJOR_GROUP_SECTORS[socCode.slice(0, 2)] ?? 'Other';
}

export function employersFor(sector: string): string[] {
  return SECTOR_EMPLOYERS[sector] ?? ['Employers across metro Detroit'];
}
