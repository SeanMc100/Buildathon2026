import { resolve } from 'node:path';

/** Where ingestion writes, and where the app reads the programs catalog. */
export const OUTPUT_PATH = resolve(__dirname, '../../data/programs.json');
