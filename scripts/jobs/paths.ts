import { resolve } from 'node:path';

/** Where ingestion writes, and where the app reads. */
export const OUTPUT_PATH = resolve(__dirname, '../../data/jobs.json');

/** Big public downloads land here. Gitignored; never committed. */
export const CACHE_DIR = resolve(__dirname, '../../.cache');
