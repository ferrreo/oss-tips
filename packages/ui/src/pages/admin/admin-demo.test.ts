import { describe, expect, it } from 'vitest';
import {
  displayPerson,
  displayProject,
  displayTarget,
  humanizeStatus,
  requireItem,
  reviewQueue,
} from './admin-demo.js';

describe('admin display helpers', () => {
  it('prefers Grove over the grove slug', () => {
    expect(displayProject('grove')).toBe('Grove');
    expect(displayTarget('grove')).toBe('Grove');
    expect(displayTarget('pay_abc123')).toBe('pay_abc123');
  });

  it('uses operator display names', () => {
    expect(displayPerson('ops@oss.tips')).toBe('Nia Okonkwo');
    expect(displayPerson('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('humanizes stored statuses', () => {
    expect(humanizeStatus('mismatch')).toBe('Mismatch');
    expect(humanizeStatus('project_5pct')).toBe('Project pays 5%');
    expect(humanizeStatus('waiting')).toBe('Waiting');
    expect(humanizeStatus('first_payment')).toBe('First Payment');
  });

  it('keeps review queue items complete', () => {
    const first = requireItem(reviewQueue, 'reviewQueue');
    expect(first.name.length).toBeGreaterThan(0);
    expect(first.repository).toContain('/');
    expect(first.reason.length).toBeGreaterThan(0);
  });
});
