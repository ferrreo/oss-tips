import { openapiV31 } from '@apidevtools/openapi-schemas';
import { Validator, type Schema } from '@cfworker/json-schema';
import { describe, expect, it } from 'vitest';
import { generateOpenApiDocument } from './openapi.js';

describe('generated OpenAPI document', () => {
  it('conforms to the official OpenAPI 3.1 schema', () => {
    const result = new Validator(openapiV31 as unknown as Schema, '2020-12', false).validate(
      generateOpenApiDocument(),
    );

    expect(
      result.valid,
      result.errors.map((error) => `${error.instanceLocation}: ${error.error}`).join('\n'),
    ).toBe(true);
  });
});
