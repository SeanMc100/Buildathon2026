import { resolve } from 'node:path';

/** Where ingestion writes, and where verification and the app read. */
export const OUTPUT_PATH = resolve(__dirname, '../../data/events.json');

/** Events typed in by hand for organisers that publish no feed. */
export const MANUAL_EVENTS_PATH = resolve(__dirname, '../../data/manual-events.json');
