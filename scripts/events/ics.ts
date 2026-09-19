// Minimal iCalendar (RFC 5545) reader: enough for VEVENT feeds, no dependencies.

export type IcsEvent = {
  uid: string;
  summary: string;
  description: string;
  location: string;
  url: string;
  organizer: string;
  startsAt: string;
  endsAt: string | null;
};

/** Lines that begin with a space or tab continue the previous line. */
function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\([,;\\])/g, '$1')
    .trim();
}

/** Offset in ms of a named time zone at a given instant. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - at.getTime();
}

/** Turns 20260917T170000 in a named zone, or 20260917T170000Z, into a UTC ISO string. */
export function icsDateToIso(value: string, timeZone: string | null): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00', second = '00', zulu] = match;
  const wallClock = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);

  if (zulu || !timeZone) return new Date(wallClock).toISOString();

  // Guess with the offset at the wall-clock instant, then correct once for DST edges.
  let utc = wallClock - zoneOffsetMs(timeZone, new Date(wallClock));
  utc = wallClock - zoneOffsetMs(timeZone, new Date(utc));
  return new Date(utc).toISOString();
}

export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) {
        const start = current.DTSTART;
        const end = current.DTEND;
        const startsAt = start ? icsDateToIso(start.value, start.params.TZID ?? null) : null;
        if (startsAt) {
          events.push({
            uid: current.UID?.value ?? '',
            summary: unescapeText(current.SUMMARY?.value ?? ''),
            description: unescapeText(current.DESCRIPTION?.value ?? ''),
            location: unescapeText(current.LOCATION?.value ?? ''),
            url: current.URL?.value ?? '',
            organizer: current.ORGANIZER?.params.CN?.replace(/^"|"$/g, '') ?? '',
            startsAt,
            endsAt: end ? icsDateToIso(end.value, end.params.TZID ?? null) : null,
          });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const [name, ...paramParts] = line.slice(0, colon).split(';');
    const params: Record<string, string> = {};
    for (const part of paramParts) {
      const eq = part.indexOf('=');
      if (eq !== -1) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    }
    current[name.toUpperCase()] = { value: line.slice(colon + 1), params };
  }

  return events;
}
