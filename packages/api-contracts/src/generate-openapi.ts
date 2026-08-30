import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openapiV31 } from '@apidevtools/openapi-schemas';
import { Validator, type Schema } from '@cfworker/json-schema';
import { generateOpenApiDocument } from './openapi.js';

const doc = generateOpenApiDocument();
const validation = new Validator(openapiV31 as unknown as Schema, '2020-12', false).validate(doc);
if (!validation.valid) {
  throw new Error(
    validation.errors.map((error) => `${error.instanceLocation}: ${error.error}`).join('\n'),
  );
}
const outPath = join(dirname(fileURLToPath(import.meta.url)), 'openapi.json');
writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.info(`Wrote OpenAPI document to ${outPath}`);
