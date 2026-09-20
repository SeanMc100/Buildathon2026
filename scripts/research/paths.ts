import { resolve } from 'node:path';

/** Where ingestion writes, and where the app reads. */
export const OUTPUT_PATH = resolve(__dirname, '../../data/research.json');
