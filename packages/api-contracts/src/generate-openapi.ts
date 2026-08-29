import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOpenApiDocument } from './openapi.js';

const doc = generateOpenApiDocument();
const outPath = join(dirname(fileURLToPath(import.meta.url)), 'openapi.json');
writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.info(`Wrote OpenAPI document to ${outPath}`);
