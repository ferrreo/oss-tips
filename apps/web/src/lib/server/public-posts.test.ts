import { describe, expect, it } from 'vitest';
import { publicPostBody, publicPostVisibility } from './public-posts';

describe('public post visibility', () => {
  it('hides gated posts by default', () => {
    expect(publicPostVisibility(true, false)).toBe('hidden');
  });

  it('allows metadata only after project opt-in', () => {
    expect(publicPostVisibility(true, true)).toBe('metadata');
  });

  it('keeps public posts fully visible', () => {
    expect(publicPostVisibility(false, false)).toBe('full');
  });

  it('never includes body for metadata-only posts', () => {
    expect(publicPostBody('supporter-only details', 'metadata')).toBe('');
    expect(publicPostBody('public details', 'full')).toBe('public details');
  });
});
