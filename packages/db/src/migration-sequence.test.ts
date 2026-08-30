import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('migration sequence', () => {
  it('uses one contiguous numeric prefix per migration', () => {
    const migrationDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));
    const prefixes = readdirSync(migrationDirectory)
      .filter((file) => /^\d{3}_.+\.ts$/.test(file))
      .map((file) => Number(file.slice(0, 3)))
      .sort((left, right) => left - right);

    expect(prefixes).toEqual(Array.from({ length: prefixes.length }, (_, index) => index + 1));
  });
});
