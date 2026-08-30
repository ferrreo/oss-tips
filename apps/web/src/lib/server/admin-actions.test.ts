import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { auditRecord } from '../../routes/api/api-utils.js';
import {
  adminRefundIdempotencyKey,
  requireAdmin,
  readFormText,
  readMinorAmount,
  readRequiredReason,
  reviewTransition,
} from './admin-actions.js';

describe('admin action boundaries', () => {
  function eventWithAuth(
    actor: RequestEvent['locals']['actor'],
    session: RequestEvent['locals']['session'],
  ): RequestEvent {
    return {
      request: new Request('https://oss.tips/admin', {
        method: 'POST',
        headers: { origin: 'https://oss.tips' },
      }),
      url: new URL('https://oss.tips/admin'),
      locals: { actor, session },
    } as RequestEvent;
  }

  it('checks authentication and platform capability before opening the database', () => {
    expect(() => requireAdmin(eventWithAuth(null, null), 'platform.review_projects')).toThrow();
    expect(() =>
      requireAdmin(
        eventWithAuth(
          { kind: 'user', userId: 'operator', projectRoles: new Map(), platformRoles: ['support'] },
          { user: { id: 'operator' } } as RequestEvent['locals']['session'],
        ),
        'platform.review_projects',
      ),
    ).toThrow();
  });

  it('builds immutable audit records with operator identity and request metadata', () => {
    const event = eventWithAuth(
      { kind: 'user', userId: 'operator', projectRoles: new Map(), platformRoles: ['owner'] },
      { user: { id: 'operator' } } as RequestEvent['locals']['session'],
    );
    const record = auditRecord(
      event,
      { type: 'user', userId: 'operator' },
      {
        action: 'project.review.approve',
        resourceType: 'project_review',
        resourceId: '0198d6e8-0000-7000-8000-000000000001',
        metadata: { reason: 'Verified repository ownership' },
      },
    );
    expect(record).toMatchObject({
      actor_id: 'operator',
      actor_type: 'user',
      session_id: null,
      action: 'project.review.approve',
      resource_type: 'project_review',
      reason: 'Verified repository ownership',
      metadata_redacted: {},
    });
  });

  it('maps review decisions to safe project states', () => {
    expect(reviewTransition('approved')).toEqual({
      reviewStatus: 'approved',
      projectStatus: 'published',
    });
    expect(reviewTransition('pending')).toEqual({
      reviewStatus: 'pending',
      projectStatus: 'pending_review',
    });
    expect(reviewTransition('rejected')).toEqual({
      reviewStatus: 'rejected',
      projectStatus: 'restricted',
    });
  });

  it('requires bounded reasons and positive minor-unit amounts', () => {
    const form = new FormData();
    form.set('reason', 'Duplicate payment confirmed');
    form.set('amountMinor', '1250');
    expect(readRequiredReason(form)).toBe('Duplicate payment confirmed');
    expect(readMinorAmount(form)).toBe(1250n);
    expect(readFormText(form, 'reason')).toBe('Duplicate payment confirmed');

    const invalid = new FormData();
    invalid.set('amountMinor', '-1');
    expect(() => readRequiredReason(invalid)).toThrow();
    invalid.set('reason', 'x');
    expect(() => readMinorAmount(invalid)).toThrow();
  });

  it('derives a stable, operation-scoped refund key', () => {
    const first = adminRefundIdempotencyKey('0198d6e8-0000-7000-8000-000000000001', 'case-1042');
    expect(first).toBe(
      adminRefundIdempotencyKey('0198d6e8-0000-7000-8000-000000000001', 'case-1042'),
    );
    expect(first).not.toBe(
      adminRefundIdempotencyKey('0198d6e8-0000-7000-8000-000000000002', 'case-1042'),
    );
    expect(first).not.toBe(
      adminRefundIdempotencyKey('0198d6e8-0000-7000-8000-000000000001', 'case-1043'),
    );
  });
});
