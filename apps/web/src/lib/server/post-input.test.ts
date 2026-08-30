import { describe, expect, it } from 'vitest';
import { readPostCreateInput, readPostPatchInput } from './post-input';

function request(value: unknown): Request {
  return new Request('https://oss.tips/api/v1/project/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
}

describe('post input boundary', () => {
  it('normalizes markdown line endings and stores supporter visibility', async () => {
    const result = await readPostCreateInput(
      request({
        title: 'Release',
        slug: 'release',
        body: '# Ready\r\n\r\nNo raw HTML is trusted.',
        visibility: 'signed_in_supporter',
      }),
    );

    expect(result).toEqual({
      title: 'Release',
      slug: 'release',
      body: '# Ready\n\nNo raw HTML is trusted.',
      visibility: { kind: 'signed_in_supporter', minimumTierRank: null, selectedTierIds: null },
      scheduledAt: null,
      notifySupporters: false,
    });
  });

  it('supports selected tiers and rejects unknown fields', async () => {
    const selected = await readPostCreateInput(
      request({ title: 'Members', slug: 'members', selected_tier_ids: ['tier-1'] }),
    );
    expect(selected).toMatchObject({
      visibility: { kind: 'selected_tier_ids', selectedTierIds: ['tier-1'] },
    });

    const unknown = await readPostCreateInput(
      request({ title: 'Nope', slug: 'nope', html: '<script>alert(1)</script>' }),
    );
    expect(unknown).toBeInstanceOf(Response);
    expect((unknown as Response).status).toBe(400);
  });

  it('normalizes patch bodies and permits explicit visibility changes', async () => {
    const result = await readPostPatchInput(
      request({
        body: 'line one\rline two',
        visibility: 'minimum_tier_rank',
        minimum_tier_rank: 2,
      }),
    );
    expect(result).toMatchObject({
      body: 'line one\nline two',
      visibility: { kind: 'minimum_tier_rank', minimumTierRank: 2 },
    });
  });

  it('accepts future scheduling and explicit supporter notification', async () => {
    const result = await readPostCreateInput(
      request({
        title: 'Later',
        slug: 'later',
        body: 'Soon',
        scheduled_at: '2030-01-01T00:00:00.000Z',
        notify_supporters: true,
      }),
    );
    expect(result).toMatchObject({
      scheduledAt: new Date('2030-01-01T00:00:00.000Z'),
      notifySupporters: true,
    });
  });
});
