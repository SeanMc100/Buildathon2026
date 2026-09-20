// What counts as "Detroit" for the launch region.

/** Cities in metro Detroit (Wayne, Oakland, Macomb) plus Ann Arbor. Extend as sources need. */
const METRO_CITIES = [
  'Detroit', 'Dearborn', 'Dearborn Heights', 'Ann Arbor', 'Ypsilanti', 'Southfield', 'Royal Oak', 'Ferndale',
  'Hamtramck', 'Highland Park', 'Warren', 'Troy', 'Livonia', 'Pontiac', 'Farmington', 'Farmington Hills',
  'Sterling Heights', 'Birmingham', 'Bloomfield Hills', 'Novi', 'Auburn Hills', 'Rochester', 'Rochester Hills',
  'Madison Heights', 'Oak Park', 'Taylor', 'Wayne', 'Lincoln Park', 'Allen Park', 'Southgate', 'Romulus',
  'Canton', 'Plymouth', 'Westland', 'Redford', 'Eastpointe', 'Roseville', 'St. Clair Shores', 'Clinton Township',
  'Grosse Pointe', 'Wixom', 'Northville', 'Center Line', 'Hazel Park', 'Inkster', 'Garden City',
];

// Longest names first, so "Rochester Hills" wins over "Rochester".
const METRO = new RegExp(
  `\\b(${[...METRO_CITIES].sort((a, b) => b.length - a.length).map((name) => name.replace('.', '\\.')).join('|')})\\b`,
  'i',
);

/** The metro city named in a location string, or null if there is none. */
export function metroCity(text: string | null): string | null {
  return text ? (METRO.exec(text)?.[1] ?? null) : null;
}
