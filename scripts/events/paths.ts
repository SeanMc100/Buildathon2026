import { resolve } from 'node:path';

/** Where ingestion writes, and where verification and the app read. */
export const OUTPUT_PATH = resolve(__dirname, '../../data/events.json');
