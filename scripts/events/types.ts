// Shapes shared by the event ingestion scripts.

/** One event exactly as a source described it, before any tagging. */
export type RawEvent = {
  /** Which source produced it, e.g. 'techtown'. Used for dedupe and reporting. */
  source: string;
  /** Stable id inside that source. */
  sourceId: string;
  title: string;
  /** Plain text, may be empty. */
  description: string;
  url: string;
  /** ISO 8601 in UTC. */
  startsAt: string;
  endsAt: string | null;
  /** Venue and address as the source wrote it. Null when hidden or absent. */
  location: string | null;
  city: string | null;
  isOnline: boolean;
  /** 0 = free, null = unknown. */
  costUsd: number | null;
  organizer: string;
};

/** A source is a named function, so one failing never stops the others. */
export type EventSource = {
  name: string;
  /** What we fetch, shown in the run report. */
  endpoint: string;
  fetch: () => Promise<RawEvent[]>;
};
