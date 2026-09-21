// The occupations the app recommends as jobs, and what each one is called.
//
// BLS prices about 700 occupations for metro Detroit and O*NET describes all of
// them, but a person opening the app is looking for the roles they have heard
// of — Software Engineer, Financial Manager, Electrician — not Neurodiagnostic
// Technologist. Local employment cannot draw that line (Allergists and
// Immunologists, Energy Engineers and Regulatory Affairs Managers all clear any
// headcount bar), so this list is the cut. It is editorial: add or remove a line
// and re-run `npm run ingest:jobs`.
//
// The title is what a person would type, not the federal one ("Software
// Developers" is 15-1252 in BLS). Employer-specific programmes — internships,
// apprenticeships, "entry roles at X" — are not occupations and live in
// entry-routes.ts; the app lists those separately from these.

export const COMMON_ROLES: Record<string, string> = {
  // Management
  '11-1021': 'General Manager', // General and Operations Managers
  '11-3031': 'Financial Manager', // Financial Managers
  '11-2022': 'Sales Manager', // Sales Managers
  '11-2021': 'Marketing Manager', // Marketing Managers
  '11-3121': 'Human Resources Manager', // Human Resources Managers
  '11-3021': 'IT Manager', // Computer and Information Systems Managers
  '13-1082': 'Project Manager', // Project Management Specialists
  '13-1111': 'Management Consultant', // Management Analysts
  '11-9021': 'Construction Manager', // Construction Managers
  '11-9111': 'Healthcare Manager', // Medical and Health Services Managers
  '11-9051': 'Restaurant Manager', // Food Service Managers
  '11-3051': 'Production Manager', // Industrial Production Managers
  '11-9141': 'Property Manager', // Property, Real Estate, and Community Association Managers
  // Finance, business and legal
  '13-2011': 'Accountant', // Accountants and Auditors
  '13-2051': 'Financial Analyst', // Financial and Investment Analysts
  '13-2052': 'Financial Advisor', // Personal Financial Advisors
  '13-2072': 'Loan Officer', // Loan Officers
  '43-3071': 'Bank Teller', // Tellers
  '41-3021': 'Insurance Agent', // Insurance Sales Agents
  '13-1161': 'Marketing Specialist', // Market Research Analysts and Marketing Specialists
  '13-1071': 'Human Resources Specialist', // Human Resources Specialists
  '27-3031': 'Public Relations Specialist', // Public Relations Specialists
  '23-2011': 'Paralegal', // Paralegals and Legal Assistants
  '23-1011': 'Lawyer', // Lawyers
  '27-1024': 'Graphic Designer', // Graphic Designers
  // Technology and engineering
  '15-1252': 'Software Engineer', // Software Developers
  '15-2051': 'Data Scientist', // Data Scientists
  '15-1211': 'Systems Analyst', // Computer Systems Analysts
  '15-1232': 'IT Support Specialist', // Computer User Support Specialists
  '15-1244': 'Network Administrator', // Network and Computer Systems Administrators
  '17-2141': 'Mechanical Engineer', // Mechanical Engineers
  '17-2112': 'Industrial Engineer', // Industrial Engineers
  '17-2071': 'Electrical Engineer', // Electrical Engineers
  '17-2051': 'Civil Engineer', // Civil Engineers
  // Healthcare
  '29-1141': 'Registered Nurse', // Registered Nurses
  '29-2061': 'Licensed Practical Nurse', // Licensed Practical and Licensed Vocational Nurses
  '29-1171': 'Nurse Practitioner', // Nurse Practitioners
  '31-1131': 'Nursing Assistant', // Nursing Assistants
  '31-9092': 'Medical Assistant', // Medical Assistants
  '43-6013': 'Medical Office Assistant', // Medical Secretaries and Administrative Assistants
  '29-1051': 'Pharmacist', // Pharmacists
  '29-2052': 'Pharmacy Technician', // Pharmacy Technicians
  '31-9091': 'Dental Assistant', // Dental Assistants
  '29-1292': 'Dental Hygienist', // Dental Hygienists
  '29-1123': 'Physical Therapist', // Physical Therapists
  '29-1071': 'Physician Assistant', // Physician Assistants
  // Education and social services
  '25-2021': 'Elementary School Teacher', // Elementary School Teachers, Except Special Education
  '25-2022': 'Middle School Teacher', // Middle School Teachers, Except Special and Career/Technical Education
  '25-2031': 'High School Teacher', // Secondary School Teachers, Except Special and Career/Technical Education
  '25-2011': 'Preschool Teacher', // Preschool Teachers, Except Special Education
  '21-1012': 'School Counselor', // Educational, Guidance, and Career Counselors and Advisors
  '21-1021': 'Social Worker', // Child, Family, and School Social Workers
  '21-1093': 'Human Services Assistant', // Social and Human Service Assistants
  // Public safety
  '33-3051': 'Police Officer', // Police and Sheriff's Patrol Officers
  '33-2011': 'Firefighter', // Firefighters
  '33-9032': 'Security Guard', // Security Guards
  // Sales and office
  '41-2031': 'Retail Salesperson', // Retail Salespersons
  '41-2011': 'Cashier', // Cashiers
  '41-4012': 'Sales Representative', // Sales Representatives, Wholesale and Manufacturing, Except Technical and Scientific Products
  '43-4051': 'Customer Service Representative', // Customer Service Representatives
  '41-1011': 'Retail Supervisor', // First-Line Supervisors of Retail Sales Workers
  '53-7065': 'Stocker', // Stockers and Order Fillers
  '43-9061': 'Office Clerk', // Office Clerks, General
  '43-6014': 'Administrative Assistant', // Secretaries and Administrative Assistants, Except Legal, Medical, and Executive
  '43-6011': 'Executive Assistant', // Executive Secretaries and Executive Administrative Assistants
  '43-4171': 'Receptionist', // Receptionists and Information Clerks
  '43-1011': 'Office Supervisor', // First-Line Supervisors of Office and Administrative Support Workers
  '43-5071': 'Shipping and Receiving Clerk', // Shipping, Receiving, and Inventory Clerks
  // Food, cleaning and personal care
  '35-3023': 'Fast Food Worker', // Fast Food and Counter Workers
  '35-3031': 'Server', // Waiters and Waitresses
  '35-2014': 'Cook', // Cooks, Restaurant
  '35-1012': 'Food Service Supervisor', // First-Line Supervisors of Food Preparation and Serving Workers
  '35-2021': 'Food Prep Worker', // Food Preparation Workers
  '35-9021': 'Dishwasher', // Dishwashers
  '35-9031': 'Host', // Hosts and Hostesses, Restaurant, Lounge, and Coffee Shop
  '37-2011': 'Janitor', // Janitors and Cleaners, Except Maids and Housekeeping Cleaners
  '37-2012': 'Housekeeper', // Maids and Housekeeping Cleaners
  '37-3011': 'Landscaper', // Landscaping and Groundskeeping Workers
  '39-5012': 'Hairstylist', // Hairdressers, Hairstylists, and Cosmetologists
  '39-9031': 'Fitness Trainer', // Exercise Trainers and Group Fitness Instructors
  // Trades and construction
  '47-2111': 'Electrician', // Electricians
  '47-2152': 'Plumber', // Plumbers, Pipefitters, and Steamfitters
  '47-2031': 'Carpenter', // Carpenters
  '49-9021': 'HVAC Technician', // Heating, Air Conditioning, and Refrigeration Mechanics and Installers
  '49-3023': 'Auto Mechanic', // Automotive Service Technicians and Mechanics
  '49-3031': 'Diesel Mechanic', // Bus and Truck Mechanics and Diesel Engine Specialists
  '49-9071': 'Maintenance Worker', // Maintenance and Repair Workers, General
  '49-9041': 'Industrial Mechanic', // Industrial Machinery Mechanics
  '47-2061': 'Construction Laborer', // Construction Laborers
  '47-1011': 'Construction Supervisor', // First-Line Supervisors of Construction Trades and Extraction Workers
  // Manufacturing, warehouse and driving
  '51-4041': 'Machinist', // Machinists
  '51-4121': 'Welder', // Welders, Cutters, Solderers, and Brazers
  '51-4031': 'Machine Operator', // Cutting, Punching, and Press Machine Setters, Operators, and Tenders, Metal and Plastic
  '51-2031': 'Assembler', // Engine and Other Machine Assemblers
  '51-9061': 'Quality Inspector', // Inspectors, Testers, Sorters, Samplers, and Weighers
  '53-7064': 'Packer', // Packers and Packagers, Hand
  '51-1011': 'Production Supervisor', // First-Line Supervisors of Production and Operating Workers
  '53-7062': 'Warehouse Worker', // Laborers and Freight, Stock, and Material Movers, Hand
  '53-7051': 'Forklift Operator', // Industrial Truck and Tractor Operators
  '53-3032': 'Truck Driver', // Heavy and Tractor-Trailer Truck Drivers
  '53-3033': 'Delivery Driver', // Light Truck Drivers
  '43-5052': 'Mail Carrier', // Postal Service Mail Carriers
};
